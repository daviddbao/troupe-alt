import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTestDb } from "../helpers/db"
import { profiles, trips, tripMembers, availabilityBlocks } from "@/lib/db/schema"
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
