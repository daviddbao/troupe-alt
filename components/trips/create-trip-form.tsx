"use client"

import { useActionState, useRef } from "react"
import { createTrip } from "@/lib/actions/trips"

export function CreateTripForm() {
  const [state, action, pending] = useActionState(createTrip, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={action} className="flex gap-2">
      <input
        name="name"
        type="text"
        required
        placeholder="Name your trip…"
        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
      />
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {pending ? "Creating…" : "New trip"}
      </button>
      {state?.error && (
        <p className="text-sm text-red-600 mt-1">{state.error}</p>
      )}
    </form>
  )
}
