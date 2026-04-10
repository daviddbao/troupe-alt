import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { AccountForm } from "@/components/account/account-form"

export default async function AccountPage() {
  const session = await auth()
  const profile = await db
    .select({ displayName: profiles.displayName, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, session!.user.id))
    .get()

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">Account</h1>
      <AccountForm
        displayName={profile?.displayName ?? ""}
        email={profile?.email ?? ""}
      />
    </div>
  )
}
