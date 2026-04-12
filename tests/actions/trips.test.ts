import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTestDb } from "../helpers/db"
import { profiles, trips, tripMembers, availabilityBlocks, tripInvites, tripActivities } from "@/lib/db/schema"
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

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  testDb = createTestDb()
  vi.clearAllMocks()
  await seedUser(testDb, "user-1", "alice@example.com", "Alice")
})

describe("createTrip", () => {
  it("creates a trip and adds creator as organizer", async () => {
    const { createTrip } = await import("@/lib/actions/trips")

    try {
      await createTrip(undefined, makeFormData({ name: "Beach Trip" }))
    } catch {
      // redirect on success — expected
    }

    const trip = await testDb.select().from(trips).get()
    expect(trip?.name).toBe("Beach Trip")
    expect(trip?.createdBy).toBe("user-1")

    const member = await testDb
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.userId, "user-1"))
      .get()
    expect(member?.role).toBe("organizer")
  })

  it("returns error when name is empty", async () => {
    const { createTrip } = await import("@/lib/actions/trips")
    const result = await createTrip(undefined, makeFormData({ name: "" }))
    expect(result?.error).toMatch(/required/i)
  })
})

describe("setAvailabilityDates", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("saves dates for a member", async () => {
    const { setAvailabilityDates } = await import("@/lib/actions/trips")
    await setAvailabilityDates("trip-1", ["2026-07-04", "2026-07-05"])

    const rows = await testDb
      .select()
      .from(availabilityBlocks)
      .where(and(eq(availabilityBlocks.tripId, "trip-1"), eq(availabilityBlocks.userId, "user-1")))
    expect(rows.map((r) => r.date)).toEqual(expect.arrayContaining(["2026-07-04", "2026-07-05"]))
  })

  it("replaces existing dates on second save", async () => {
    const { setAvailabilityDates } = await import("@/lib/actions/trips")
    await setAvailabilityDates("trip-1", ["2026-07-04", "2026-07-05"])
    await setAvailabilityDates("trip-1", ["2026-08-01"])

    const rows = await testDb
      .select()
      .from(availabilityBlocks)
      .where(and(eq(availabilityBlocks.tripId, "trip-1"), eq(availabilityBlocks.userId, "user-1")))
    expect(rows).toHaveLength(1)
    expect(rows[0].date).toBe("2026-08-01")
  })

  it("clears all dates when passed empty array", async () => {
    const { setAvailabilityDates } = await import("@/lib/actions/trips")
    await setAvailabilityDates("trip-1", ["2026-07-04"])
    await setAvailabilityDates("trip-1", [])

    const rows = await testDb
      .select()
      .from(availabilityBlocks)
      .where(eq(availabilityBlocks.tripId, "trip-1"))
    expect(rows).toHaveLength(0)
  })
})

// ── Additional seed helpers ───────────────────────────────────────────────────

async function seedInvite(db: ReturnType<typeof createTestDb>, tripId: string, code: string) {
  await db.insert(tripInvites).values({ id: crypto.randomUUID(), tripId, code })
}

async function seedActivity(
  db: ReturnType<typeof createTestDb>,
  id: string,
  tripId: string,
  createdBy: string,
  overrides: Partial<{ date: string; startHour: number; endHour: number; title: string; type: string }> = {}
) {
  await db.insert(tripActivities).values({
    id,
    tripId,
    createdBy,
    date: overrides.date ?? "2026-07-04",
    startHour: overrides.startHour ?? 9,
    endHour: overrides.endHour ?? 10,
    title: overrides.title ?? "Test Activity",
    type: overrides.type ?? "group",
  })
}

describe("getTripAggregateAvailability", () => {
  beforeEach(async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
    await testDb.insert(tripMembers).values({ tripId: "trip-1", userId: "user-2", role: "member" })
  })

  it("returns correct date counts across members", async () => {
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")

    // user-1 (session user): July 4–5
    await testDb.insert(availabilityBlocks).values([
      { id: crypto.randomUUID(), tripId: "trip-1", userId: "user-1", date: "2026-07-04" },
      { id: crypto.randomUUID(), tripId: "trip-1", userId: "user-1", date: "2026-07-05" },
    ])
    // user-2: July 4 only
    await testDb.insert(availabilityBlocks).values([
      { id: crypto.randomUUID(), tripId: "trip-1", userId: "user-2", date: "2026-07-04" },
    ])

    const result = await getTripAggregateAvailability("trip-1")
    expect(result).not.toBeNull()
    expect(result!.memberCount).toBe(2)
    expect(result!.dateCounts["2026-07-04"]).toBe(2)
    expect(result!.dateCounts["2026-07-05"]).toBe(1)
    expect(result!.submittedUserIds).toEqual(expect.arrayContaining(["user-1", "user-2"]))
  })

  it("returns empty dateCounts when no availability submitted", async () => {
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    expect(result!.dateCounts).toEqual({})
    expect(result!.submittedUserIds).toHaveLength(0)
  })
})

// ── getTripWithMembers ────────────────────────────────────────────────────────

describe("getTripWithMembers", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("returns trip and members when user is a member", async () => {
    const { getTripWithMembers } = await import("@/lib/actions/trips")
    const result = await getTripWithMembers("trip-1")
    expect(result).not.toBeNull()
    expect(result!.trip.name).toBe("Beach Trip")
    expect(result!.members).toHaveLength(1)
    expect(result!.members[0].userId).toBe("user-1")
    expect(result!.members[0].role).toBe("organizer")
  })

  it("returns null when trip does not exist", async () => {
    const { getTripWithMembers } = await import("@/lib/actions/trips")
    const result = await getTripWithMembers("nonexistent-trip")
    expect(result).toBeNull()
  })

  it("returns null when user is not a member", async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { getTripWithMembers } = await import("@/lib/actions/trips")
    const result = await getTripWithMembers("trip-1")
    expect(result).toBeNull()
  })
})

// ── getUserTrips ──────────────────────────────────────────────────────────────

describe("getUserTrips", () => {
  it("returns all trips the user belongs to with member counts", async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
    await testDb.insert(tripMembers).values({ tripId: "trip-1", userId: "user-2", role: "member" })

    const { getUserTrips } = await import("@/lib/actions/trips")
    const result = await getUserTrips()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Beach Trip")
    expect(result[0].memberCount).toBe(2)
  })

  it("returns empty array when user has no trips", async () => {
    const { getUserTrips } = await import("@/lib/actions/trips")
    const result = await getUserTrips()
    expect(result).toEqual([])
  })

  it("returns empty array when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const { getUserTrips } = await import("@/lib/actions/trips")
    const result = await getUserTrips()
    expect(result).toEqual([])
  })
})

// ── getExistingInvite ─────────────────────────────────────────────────────────

describe("getExistingInvite", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("returns the invite code when one exists", async () => {
    await seedInvite(testDb, "trip-1", "abc123invite")
    const { getExistingInvite } = await import("@/lib/actions/trips")
    const code = await getExistingInvite("trip-1")
    expect(code).toBe("abc123invite")
  })

  it("returns null when no invite exists", async () => {
    const { getExistingInvite } = await import("@/lib/actions/trips")
    const code = await getExistingInvite("trip-1")
    expect(code).toBeNull()
  })
})

// ── createInvite ──────────────────────────────────────────────────────────────

describe("createInvite", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("creates and returns a new invite code for a member", async () => {
    const { createInvite } = await import("@/lib/actions/trips")
    const result = await createInvite("trip-1")
    expect(result.code).toBeTruthy()
    expect(typeof result.code).toBe("string")
    expect((result.code as string).length).toBeGreaterThan(0)
  })

  it("returns existing code if invite already exists", async () => {
    await seedInvite(testDb, "trip-1", "existingcode1")
    const { createInvite } = await import("@/lib/actions/trips")
    const result = await createInvite("trip-1")
    expect(result.code).toBe("existingcode1")
  })

  it("returns error for non-member", async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { createInvite } = await import("@/lib/actions/trips")
    const result = await createInvite("trip-1")
    expect(result.error).toMatch(/not a member/i)
  })
})

// ── joinTripByCode ────────────────────────────────────────────────────────────

describe("joinTripByCode", () => {
  beforeEach(async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
    await seedInvite(testDb, "trip-1", "validcode123")
  })

  it("adds user as member when code is valid", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { joinTripByCode } = await import("@/lib/actions/trips")
    try {
      await joinTripByCode("validcode123")
    } catch {
      // redirect on success — expected
    }
    const member = await testDb
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-2")))
      .get()
    expect(member).toBeDefined()
    expect(member!.role).toBe("member")
  })

  it("does not create duplicate membership for existing member", async () => {
    await testDb.insert(tripMembers).values({ tripId: "trip-1", userId: "user-2", role: "member" })
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { joinTripByCode } = await import("@/lib/actions/trips")
    try {
      await joinTripByCode("validcode123")
    } catch {
      // redirect — expected
    }
    const members = await testDb
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, "trip-1"), eq(tripMembers.userId, "user-2")))
    expect(members).toHaveLength(1)
  })

  it("returns error for invalid invite code", async () => {
    const { joinTripByCode } = await import("@/lib/actions/trips")
    const result = await joinTripByCode("badcode")
    expect(result?.error).toMatch(/invalid invite/i)
  })
})

// ── savePreferences ───────────────────────────────────────────────────────────

describe("savePreferences", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("saves preferences to the trip", async () => {
    const { savePreferences } = await import("@/lib/actions/trips")
    await savePreferences("trip-1", { nights: 3, weather: "Warm", geography: "Beach" })
    const trip = await testDb.select().from(trips).where(eq(trips.id, "trip-1")).get()
    const prefs = trip!.preferences as { nights?: number; weather?: string } | null
    expect(prefs?.nights).toBe(3)
    expect(prefs?.weather).toBe("Warm")
  })

  it("returns error for non-member", async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { savePreferences } = await import("@/lib/actions/trips")
    const result = await savePreferences("trip-1", { nights: 2 })
    expect(result?.error).toMatch(/not a member/i)
  })
})

// ── getUserAvailability ───────────────────────────────────────────────────────

describe("getUserAvailability", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("returns the user's submitted dates for a trip", async () => {
    await testDb.insert(availabilityBlocks).values([
      { id: crypto.randomUUID(), tripId: "trip-1", userId: "user-1", date: "2026-07-04" },
      { id: crypto.randomUUID(), tripId: "trip-1", userId: "user-1", date: "2026-07-05" },
    ])
    const { getUserAvailability } = await import("@/lib/actions/trips")
    const dates = await getUserAvailability("trip-1")
    expect(dates).toEqual(expect.arrayContaining(["2026-07-04", "2026-07-05"]))
    expect(dates).toHaveLength(2)
  })

  it("returns empty array when user has no availability", async () => {
    const { getUserAvailability } = await import("@/lib/actions/trips")
    const dates = await getUserAvailability("trip-1")
    expect(dates).toEqual([])
  })
})

// ── getTripActivities ─────────────────────────────────────────────────────────

describe("getTripActivities", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("returns activities for a trip member", async () => {
    await seedActivity(testDb, "act-1", "trip-1", "user-1", { title: "Hike" })
    const { getTripActivities } = await import("@/lib/actions/trips")
    const activities = await getTripActivities("trip-1")
    expect(activities).toHaveLength(1)
    expect(activities[0].title).toBe("Hike")
    expect(activities[0].createdBy).toBe("user-1")
  })

  it("returns empty array for non-members", async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { getTripActivities } = await import("@/lib/actions/trips")
    const activities = await getTripActivities("trip-1")
    expect(activities).toEqual([])
  })
})

// ── addTripActivity ───────────────────────────────────────────────────────────

describe("addTripActivity", () => {
  beforeEach(async () => {
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
  })

  it("adds a new activity for a trip member", async () => {
    const { addTripActivity } = await import("@/lib/actions/trips")
    await addTripActivity("trip-1", { date: "2026-07-04", startHour: 9, endHour: 11, title: "Morning hike", type: "group" })
    const activities = await testDb.select().from(tripActivities).where(eq(tripActivities.tripId, "trip-1"))
    expect(activities).toHaveLength(1)
    expect(activities[0].title).toBe("Morning hike")
    expect(activities[0].createdBy).toBe("user-1")
    expect(activities[0].startHour).toBe(9)
    expect(activities[0].endHour).toBe(11)
  })

  it("returns error when title is empty", async () => {
    const { addTripActivity } = await import("@/lib/actions/trips")
    const result = await addTripActivity("trip-1", { date: "2026-07-04", startHour: 9, endHour: 11, title: "   ", type: "group" })
    expect(result?.error).toMatch(/title is required/i)
  })

  it("returns error when endHour is not after startHour", async () => {
    const { addTripActivity } = await import("@/lib/actions/trips")
    const sameHour = await addTripActivity("trip-1", { date: "2026-07-04", startHour: 10, endHour: 10, title: "Lunch", type: "group" })
    expect(sameHour?.error).toMatch(/end time/i)

    const earlier = await addTripActivity("trip-1", { date: "2026-07-04", startHour: 12, endHour: 10, title: "Lunch", type: "group" })
    expect(earlier?.error).toMatch(/end time/i)
  })

  it("returns error for non-member", async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { addTripActivity } = await import("@/lib/actions/trips")
    const result = await addTripActivity("trip-1", { date: "2026-07-04", startHour: 9, endHour: 11, title: "Hike", type: "group" })
    expect(result?.error).toMatch(/not a member/i)
  })
})

// ── deleteTripActivity ────────────────────────────────────────────────────────

describe("deleteTripActivity", () => {
  beforeEach(async () => {
    await seedUser(testDb, "user-2", "bob@example.com", "Bob")
    await seedTrip(testDb, "trip-1", "Beach Trip", "user-1")
    await testDb.insert(tripMembers).values({ tripId: "trip-1", userId: "user-2", role: "member" })
    // user-2 owns this activity
    await seedActivity(testDb, "act-1", "trip-1", "user-2", { title: "Bob's activity" })
  })

  it("creator can delete their own activity", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-2", email: "bob@example.com", name: "Bob" } } as any)
    const { deleteTripActivity } = await import("@/lib/actions/trips")
    await deleteTripActivity("trip-1", "act-1")
    const remaining = await testDb.select().from(tripActivities).where(eq(tripActivities.id, "act-1"))
    expect(remaining).toHaveLength(0)
  })

  it("organizer can delete another member's activity", async () => {
    // user-1 is organizer, act-1 is owned by user-2
    const { deleteTripActivity } = await import("@/lib/actions/trips")
    await deleteTripActivity("trip-1", "act-1")
    const remaining = await testDb.select().from(tripActivities).where(eq(tripActivities.id, "act-1"))
    expect(remaining).toHaveLength(0)
  })

  it("non-creator regular member cannot delete another's activity", async () => {
    await seedUser(testDb, "user-3", "carol@example.com", "Carol")
    await testDb.insert(tripMembers).values({ tripId: "trip-1", userId: "user-3", role: "member" })
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-3", email: "carol@example.com", name: "Carol" } } as any)
    const { deleteTripActivity } = await import("@/lib/actions/trips")
    const result = await deleteTripActivity("trip-1", "act-1")
    expect(result?.error).toMatch(/your own activities/i)
    // Activity should still exist
    const remaining = await testDb.select().from(tripActivities).where(eq(tripActivities.id, "act-1"))
    expect(remaining).toHaveLength(1)
  })

  it("returns error when activity does not exist", async () => {
    const { deleteTripActivity } = await import("@/lib/actions/trips")
    const result = await deleteTripActivity("trip-1", "nonexistent-act")
    expect(result?.error).toMatch(/not found/i)
  })
})
