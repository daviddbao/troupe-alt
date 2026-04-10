import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTestDb } from "../helpers/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// ── Mocks ────────────────────────────────────────────────────────────────────

let testDb: ReturnType<typeof createTestDb>

vi.mock("@/lib/db", () => ({ get db() { return testDb } }))

vi.mock("next-auth", () => ({
  default: vi.fn(),
  AuthError: class AuthError extends Error { type = "AuthError" },
}))

vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }) }),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Use fast bcrypt cost for tests
vi.mock("bcryptjs", () => ({
  default: {
    hash: async (pwd: string) => `hashed:${pwd}`,
    compare: async (pwd: string, hash: string) => hash === `hashed:${pwd}`,
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return fd
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  testDb = createTestDb()
  vi.clearAllMocks()
})

describe("signup", () => {
  it("creates a profile for valid input", async () => {
    const { signup } = await import("@/lib/actions/auth")
    const { signIn } = await import("@/lib/auth")

    try {
      await signup(undefined, makeFormData({
        email: "alice@example.com",
        password: "password123",
        displayName: "Alice",
      }))
    } catch {
      // signIn triggers redirect — expected
    }

    const user = await testDb.select().from(profiles).where(eq(profiles.email, "alice@example.com")).get()
    expect(user).toBeDefined()
    expect(user!.displayName).toBe("Alice")
    expect(user!.passwordHash).toBe("hashed:password123")
    expect(signIn).toHaveBeenCalledOnce()
  })

  it("returns error when email already exists", async () => {
    const { signup } = await import("@/lib/actions/auth")

    // Seed existing user
    await testDb.insert(profiles).values({
      id: crypto.randomUUID(),
      email: "alice@example.com",
      displayName: "Alice",
      passwordHash: "hashed:password123",
    })

    const result = await signup(undefined, makeFormData({
      email: "alice@example.com",
      password: "password123",
      displayName: "Alice",
    }))

    expect(result?.error).toMatch(/already exists/i)
  })

  it("returns error when password is too short", async () => {
    const { signup } = await import("@/lib/actions/auth")

    const result = await signup(undefined, makeFormData({
      email: "bob@example.com",
      password: "short",
      displayName: "Bob",
    }))

    expect(result?.error).toMatch(/8 characters/i)
  })
})

describe("login", () => {
  beforeEach(async () => {
    await testDb.insert(profiles).values({
      id: crypto.randomUUID(),
      email: "alice@example.com",
      displayName: "Alice",
      passwordHash: "hashed:correctpass",
    })
  })

  it("returns error when email not found", async () => {
    const { login } = await import("@/lib/actions/auth")

    const result = await login(undefined, makeFormData({
      email: "nobody@example.com",
      password: "anything",
    }))

    expect(result?.error).toMatch(/no account found/i)
  })

  it("returns error when password is wrong", async () => {
    const { login } = await import("@/lib/actions/auth")

    const result = await login(undefined, makeFormData({
      email: "alice@example.com",
      password: "wrongpass",
    }))

    expect(result?.error).toMatch(/incorrect password/i)
  })

  it("calls signIn with correct credentials on success", async () => {
    const { login } = await import("@/lib/actions/auth")
    const { signIn } = await import("@/lib/auth")

    try {
      await login(undefined, makeFormData({
        email: "alice@example.com",
        password: "correctpass",
      }))
    } catch {
      // redirect throws — expected
    }

    expect(signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({
      email: "alice@example.com",
      password: "correctpass",
    }))
  })
})
