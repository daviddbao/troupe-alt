"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateDisplayName(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const displayName = (formData.get("displayName") as string)?.trim()
  if (!displayName) return { error: "Name cannot be empty." }

  await db
    .update(profiles)
    .set({ displayName })
    .where(eq(profiles.id, session.user.id))

  revalidatePath("/account")
  return { success: true }
}
