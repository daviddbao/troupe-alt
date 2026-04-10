"use client"

import { useActionState, useRef, useState } from "react"
import { createTrip } from "@/lib/actions/trips"

export function CreateTripForm({ inline = false }: { inline?: boolean }) {
  const [state, action, pending] = useActionState(createTrip, undefined)
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  if (inline) {
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
        {state?.error && <p className="text-sm text-red-600 mt-1">{state.error}</p>}
      </form>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New trip
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl">
            <h2 className="font-semibold mb-4">New trip</h2>
            <form ref={formRef} action={action} className="space-y-4">
              <input
                name="name"
                type="text"
                required
                autoFocus
                placeholder="Name your trip…"
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
              {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {pending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
