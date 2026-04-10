"use server"

import { signIn, signOut } from "@/lib/auth"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

export async function signup(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "All fields are required." }
  }

  // Derive display name from email prefix (e.g. "john.doe@..." → "John Doe")
  const displayName = email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Friend"

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase()))

  if (existing) {
    return { error: "An account with that email already exists." }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await db.insert(profiles).values({
    email: email.toLowerCase(),
    displayName,
    passwordHash,
  })

  await signIn("credentials", { email: email.toLowerCase(), password, redirectTo: "/dashboard" })
}

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard"

  if (!email || !password) return { error: "Email and password are required." }

  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase()))

  if (!user) return { error: "No account found with that email." }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: "Incorrect password." }

  try {
    await signIn("credentials", { email: email.toLowerCase(), password, redirectTo: callbackUrl })
  } catch (e) {
    if (e instanceof AuthError) return { error: "Something went wrong. Please try again." }
    throw e
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}

export async function updateDisplayName(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const { auth } = await import("@/lib/auth")
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const displayName = (formData.get("displayName") as string)?.trim()
  if (!displayName) return { error: "Display name is required." }

  const { profiles: profilesTable } = await import("@/lib/db/schema")
  await db.update(profilesTable).set({ displayName }).where(eq(profilesTable.id, session.user.id))

  return { success: true }
}
