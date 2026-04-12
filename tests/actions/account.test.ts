import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTestDb } from "../helpers/db"
import { profiles } from "@/lib/db/schema"
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  testDb = createTestDb()
  vi.clearAllMocks()
  await testDb.insert(profiles).values({
    id: "user-1",
    email: "alice@example.com",
    displayName: "Alice",
    passwordHash: "x",
  })
  // Re-establish default auth mock after clearAllMocks
  const { auth } = await import("@/lib/auth")
  vi.mocked(auth).mockResolvedValue(mockSession as any)
})

describe("updateDisplayName", () => {
  it("updates the display name for a valid input", async () => {
    const { updateDisplayName } = await import("@/lib/actions/account")
    const result = await updateDisplayName(undefined, makeFormData({ displayName: "Alice Smith" }))
    expect(result?.success).toBe(true)

    const user = await testDb.select().from(profiles).where(eq(profiles.id, "user-1")).get()
    expect(user!.displayName).toBe("Alice Smith")
  })

  it("trims whitespace from the new display name", async () => {
    const { updateDisplayName } = await import("@/lib/actions/account")
    await updateDisplayName(undefined, makeFormData({ displayName: "  Alice Smith  " }))

    const user = await testDb.select().from(profiles).where(eq(profiles.id, "user-1")).get()
    expect(user!.displayName).toBe("Alice Smith")
  })

  it("returns error when display name is empty", async () => {
    const { updateDisplayName } = await import("@/lib/actions/account")
    const result = await updateDisplayName(undefined, makeFormData({ displayName: "" }))
    expect(result?.error).toMatch(/cannot be empty/i)

    // Display name should be unchanged
    const user = await testDb.select().from(profiles).where(eq(profiles.id, "user-1")).get()
    expect(user!.displayName).toBe("Alice")
  })

  it("returns error when display name is only whitespace", async () => {
    const { updateDisplayName } = await import("@/lib/actions/account")
    const result = await updateDisplayName(undefined, makeFormData({ displayName: "   " }))
    expect(result?.error).toMatch(/cannot be empty/i)
  })

  it("redirects to /login when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null as any)
    const { updateDisplayName } = await import("@/lib/actions/account")

    let redirectUrl: string | undefined
    try {
      await updateDisplayName(undefined, makeFormData({ displayName: "New Name" }))
    } catch (err: any) {
      redirectUrl = err.url
    }

    expect(redirectUrl).toBe("/login")
  })
})
