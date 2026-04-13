import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTestDb } from "../helpers/db"
import { profiles, trips, tripMembers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// ── Mocks ────────────────────────────────────────────────────────────────────

let testDb: ReturnType<typeof createTestDb>

const mockSession = { user: { id: "user-1", email: "alice@example.com", name: "Alice" } }

vi.mock("@/lib/db", () => ({ get db() { return testDb } }))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mockSession),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }) }),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedUser(db: ReturnType<typeof createTestDb>, id: string, email: string, name: string) {
  await db.insert(profiles).values({ id, email, displayName: name, passwordHash: "x" })
}

async function seedTrip(db: ReturnType<typeof createTestDb>, id: string, name: string, createdBy: string) {
  await db.insert(trips).values({ id, name, createdBy })
  await db.insert(tripMembers).values({ tripId: id, userId: createdBy, role: "organizer" })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

// Each test starts with: user-1 (organizer), user-2 (member), trip-1
beforeEach(async () => {
  testDb = createTestDb()
  vi.clearAllMocks()
  await seedUser(testDb, "user-1", "alice@example.com", "Alice")
  await seedUser(testDb, "user-2", "bob@example.com", "Bob")
  await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  await testDb.insert(tripMembers).values({ tripId: "trip-1", userId: "user-2", role: "member" })
  // Re-establish default auth mock after clearAllMocks
  const { auth } = await import("@/lib/auth")
  vi.mocked(auth).mockResolvedValue(mockSession as any)
})

// ── scheduleTripDates ─────────────────────────────────────────────────────────

describe("scheduleTripDates", () => {
  it("organizer can set scheduled dates", async () => {
    const { scheduleTripDates } = await import("@/lib/actions/trips")
    await scheduleTripDates("trip-1", "2026-07-04", "2026-07-07")
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.scheduledStart).toBe("2026-07-04")
    expect(trip!.scheduledEnd).toBe("2026-07-07")
  })

  it("non-organizer cannot schedule dates", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { scheduleTripDates } = await import("@/lib/actions/trips")
    const result = await scheduleTripDates("trip-1", "2026-07-04", "2026-07-07")
    expect(result?.error).toMatch(/organizer/i)
    // Dates should not have changed
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.scheduledStart).toBeNull()
  })
})

// ── clearTripSchedule ─────────────────────────────────────────────────────────

describe("clearTripSchedule", () => {
  beforeEach(async () => {
    await testDb
      .update(trips)
      .set({ scheduledStart: "2026-07-04", scheduledEnd: "2026-07-07" })
      .where(eq(trips.id, "trip-1"))
  })

  it("organizer can clear the schedule", async () => {
    const { clearTripSchedule } = await import("@/lib/actions/trips")
    await clearTripSchedule("trip-1")
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.scheduledStart).toBeNull()
    expect(trip!.scheduledEnd).toBeNull()
  })

  it("non-organizer cannot clear the schedule", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { clearTripSchedule } = await import("@/lib/actions/trips")
    const result = await clearTripSchedule("trip-1")
    expect(result?.error).toMatch(/organizer/i)
    // Schedule should still be set
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.scheduledStart).toBe("2026-07-04")
  })
})

// ── renameTrip ────────────────────────────────────────────────────────────────

describe("renameTrip", () => {
  it("organizer can rename the trip", async () => {
    const { renameTrip } = await import("@/lib/actions/trips")
    await renameTrip("trip-1", "Mountain Retreat")
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.name).toBe("Mountain Retreat")
  })

  it("trims whitespace from the new name", async () => {
    const { renameTrip } = await import("@/lib/actions/trips")
    await renameTrip("trip-1", "  Mountain Retreat  ")
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.name).toBe("Mountain Retreat")
  })

  it("returns error for empty name", async () => {
    const { renameTrip } = await import("@/lib/actions/trips")
    const result = await renameTrip("trip-1", "   ")
    expect(result?.error).toMatch(/required/i)
    // Name should be unchanged
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.name).toBe("Beach Trip")
  })

  it("non-organizer cannot rename the trip", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { renameTrip } = await import("@/lib/actions/trips")
    const result = await renameTrip("trip-1", "Hacked Name")
    expect(result?.error).toMatch(/organizer/i)
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    expect(trip!.name).toBe("Beach Trip")
  })
})

// ── deleteTrip ────────────────────────────────────────────────────────────────

describe("deleteTrip", () => {
  it("organizer can delete the trip", async () => {
    const { deleteTrip } = await import("@/lib/actions/trips")
    try {
      await deleteTrip("trip-1")
    } catch {
      // redirect after delete — expected
    }
    const remaining = await testDb.select().from(trips).where(eq(trips.id, "trip-1"))
    expect(remaining).toHaveLength(0)
  })

  it("cascades: trip_members are removed when trip is deleted", async () => {
    const { deleteTrip } = await import("@/lib/actions/trips")
    try {
      await deleteTrip("trip-1")
    } catch { /* redirect */ }
    const members = await testDb.select().from(tripMembers).where(eq(tripMembers.tripId, "trip-1"))
    expect(members).toHaveLength(0)
  })

  it("non-organizer cannot delete the trip", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { deleteTrip } = await import("@/lib/actions/trips")
    const result = await deleteTrip("trip-1")
    expect(result?.error).toMatch(/organizer/i)
    const remaining = await testDb.select().from(trips).where(eq(trips.id, "trip-1"))
    expect(remaining).toHaveLength(1)
  })
})

// ── leaveTrip ─────────────────────────────────────────────────────────────────

describe("leaveTrip", () => {
  it("regular member can leave the trip", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { leaveTrip } = await import("@/lib/actions/trips")
    try {
      await leaveTrip("trip-1")
    } catch {
      // redirect — expected
    }
    const member = await testDb
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-2")))
      .get()
    expect(member).toBeUndefined()
  })

  it("sole organizer cannot leave (returns promote_first)", async () => {
    const { leaveTrip } = await import("@/lib/actions/trips")
    const result = await leaveTrip("trip-1")
    expect(result?.error).toBe("promote_first")
    // user-1 should still be a member
    const member = await testDb
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-1")))
      .get()
    expect(member).toBeDefined()
  })

  it("organizer can leave when another organizer exists", async () => {
    // Promote user-2 to organizer first
    await testDb
      .update(tripMembers)
      .set({ role: "organizer" })
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-2")))
    const { leaveTrip } = await import("@/lib/actions/trips")
    try {
      await leaveTrip("trip-1")
    } catch {
      // redirect — expected
    }
    const member = await testDb
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-1")))
      .get()
    expect(member).toBeUndefined()
  })

  it("returns error when user is not a member", async () => {
    await seedUser(testDb, "user-3", "carol@example.com", "Carol")
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-3", email: "carol@example.com", name: "Carol" } } as any)
    const { leaveTrip } = await import("@/lib/actions/trips")
    const result = await leaveTrip("trip-1")
    expect(result?.error).toMatch(/not a member/i)
  })
})

// ── promoteMember ─────────────────────────────────────────────────────────────

describe("promoteMember", () => {
  it("organizer can promote a regular member to organizer", async () => {
    const { promoteMember } = await import("@/lib/actions/trips")
    await promoteMember("trip-1", "user-2")
    const member = await testDb
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-2")))
      .get()
    expect(member!.role).toBe("organizer")
  })

  it("non-organizer cannot promote members", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { promoteMember } = await import("@/lib/actions/trips")
    const result = await promoteMember("trip-1", "user-1")
    expect(result?.error).toMatch(/organizer/i)
    // user-2's role should be unchanged
    const member = await testDb
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-2")))
      .get()
    expect(member!.role).toBe("member")
  })
})
