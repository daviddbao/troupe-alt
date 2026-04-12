/**
 * Tests for the computeBestWindows algorithm, exercised via getTripAggregateAvailability.
 * The algorithm is an internal function, so we verify its behaviour through the public API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTestDb } from "../helpers/db"
import { profiles, trips, tripMembers, availabilityBlocks } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

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

async function seedTrip(db: ReturnType<typeof createTestDb>, id: string, createdBy: string) {
  await db.insert(trips).values({ id, name: "Trip", createdBy })
  await db.insert(tripMembers).values({ tripId: id, userId: createdBy, role: "organizer" })
}

async function addAvailability(
  db: ReturnType<typeof createTestDb>,
  tripId: string,
  userId: string,
  dates: string[]
) {
  for (const date of dates) {
    await db.insert(availabilityBlocks).values({ id: crypto.randomUUID(), tripId, userId, date })
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  testDb = createTestDb()
  vi.clearAllMocks()
  await seedUser(testDb, "user-1", "alice@example.com", "Alice")
  await seedUser(testDb, "user-2", "bob@example.com", "Bob")
  await seedTrip(testDb, "trip-1", "user-1")
  await testDb.insert(tripMembers).values({ tripId: "trip-1", userId: "user-2", role: "member" })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe("computeBestWindows (via getTripAggregateAvailability)", () => {
  it("returns empty bestWindows when no availability has been submitted", async () => {
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    expect(result!.bestWindows).toEqual([])
  })

  it("produces a window for a single available date", async () => {
    await addAvailability(testDb, "trip-1", "user-1", ["2026-07-01"])
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    expect(result!.bestWindows.length).toBeGreaterThan(0)
    const window = result!.bestWindows[0]
    expect(window.dates).toContain("2026-07-01")
  })

  it("groups contiguous dates into a single window", async () => {
    // Both users available on 3 consecutive days
    await addAvailability(testDb, "trip-1", "user-1", ["2026-07-01", "2026-07-02", "2026-07-03"])
    await addAvailability(testDb, "trip-1", "user-2", ["2026-07-01", "2026-07-02", "2026-07-03"])
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    // There should be a window covering all three days
    const fullWindow = result!.bestWindows.find(
      (w) => w.dates[0] === "2026-07-01" && w.dates[w.dates.length - 1] === "2026-07-03"
    )
    expect(fullWindow).toBeDefined()
    expect(fullWindow!.avg).toBe(2)
  })

  it("calculates coverage as avg / memberCount", async () => {
    // Only user-1 is available (1 out of 2 members)
    await addAvailability(testDb, "trip-1", "user-1", ["2026-07-01"])
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    const window = result!.bestWindows.find((w) => w.dates.includes("2026-07-01"))
    expect(window).toBeDefined()
    expect(window!.avg).toBe(1)
    expect(window!.coverage).toBe(0.5) // 1 / 2 members
  })

  it("returns 1.0 coverage when all members are available", async () => {
    await addAvailability(testDb, "trip-1", "user-1", ["2026-07-01"])
    await addAvailability(testDb, "trip-1", "user-2", ["2026-07-01"])
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    const window = result!.bestWindows.find((w) => w.dates.includes("2026-07-01"))
    expect(window).toBeDefined()
    expect(window!.coverage).toBe(1)
  })

  it("ranks windows by average availability count descending", async () => {
    // date A: both users available (avg 2)
    // date B: only user-1 available (avg 1)
    // Non-contiguous so they form separate windows
    await addAvailability(testDb, "trip-1", "user-1", ["2026-07-01", "2026-07-15"])
    await addAvailability(testDb, "trip-1", "user-2", ["2026-07-01"])
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    const windows = result!.bestWindows
    expect(windows.length).toBeGreaterThan(0)
    // The highest-ranked window should contain the date where both were available
    expect(windows[0].dates).toContain("2026-07-01")
    expect(windows[0].avg).toBeGreaterThanOrEqual(windows[windows.length - 1].avg)
  })

  it("non-contiguous dates produce separate windows", async () => {
    // Two isolated dates with a gap between them
    await addAvailability(testDb, "trip-1", "user-1", ["2026-07-01", "2026-07-15"])
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    const dates = result!.bestWindows.flatMap((w) => w.dates)
    expect(dates).toContain("2026-07-01")
    expect(dates).toContain("2026-07-15")
    // Verify they are in separate windows (no window spans the gap)
    const crossingWindow = result!.bestWindows.find(
      (w) => w.dates.includes("2026-07-01") && w.dates.includes("2026-07-15")
    )
    expect(crossingWindow).toBeUndefined()
  })

  it("returns at most 5 windows", async () => {
    // 7 non-contiguous dates → more than 5 candidate windows
    const dates = [
      "2026-07-01", "2026-07-03", "2026-07-05",
      "2026-07-07", "2026-07-09", "2026-07-11", "2026-07-13",
    ]
    await addAvailability(testDb, "trip-1", "user-1", dates)
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    expect(result!.bestWindows.length).toBeLessThanOrEqual(5)
  })

  it("does not produce windows shorter than minNights when preferences are set", async () => {
    // Set minNights = 3 via preferences
    await testDb.update(trips).set({ preferences: { nights: 3 } as any }).where(eq(trips.id, "trip-1"))
    // Only 2 contiguous days available — shorter than minNights
    await addAvailability(testDb, "trip-1", "user-1", ["2026-07-01", "2026-07-02"])
    const { getTripAggregateAvailability } = await import("@/lib/actions/trips")
    const result = await getTripAggregateAvailability("trip-1")
    // No window should have fewer than 3 dates
    for (const w of result!.bestWindows) {
      expect(w.dates.length).toBeGreaterThanOrEqual(3)
    }
  })
})
