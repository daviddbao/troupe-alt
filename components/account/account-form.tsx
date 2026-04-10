"use client"

import { useActionState } from "react"
import { updateDisplayName } from "@/lib/actions/account"
import { logout } from "@/lib/actions/auth"

export function AccountForm({
  displayName,
  email,
}: {
  displayName: string
  email: string
}) {
  const [state, action, pending] = useActionState(updateDisplayName, undefined)

  return (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-xl p-4 space-y-1">
        <p className="text-xs text-gray-400">Email</p>
        <p className="text-sm font-medium">{email}</p>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-1.5">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            defaultValue={displayName}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-600">Name updated!</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>

      <form action={logout}>
        <button
          type="submit"
          className="w-full py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
