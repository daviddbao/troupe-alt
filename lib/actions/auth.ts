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
  const displayName = formData.get("displayName") as string

  if (!email || !password || !displayName) {
    return { error: "All fields are required." }
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase()))
    .get()

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

  const user = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase()))
    .get()

  if (!user) return { error: "No account found with that email." }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: "Incorrect password." }

  try {
    await signIn("credentials", { email: email.toLowerCase(), password, redirectTo: callbackUrl })
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Sign in failed. Please try again." }
    }
    throw err
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}
