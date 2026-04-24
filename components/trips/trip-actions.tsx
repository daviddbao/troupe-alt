"use client"

import { useState, useTransition } from "react"
import { deleteTrip, leaveTrip, renameTrip, promoteMember } from "@/lib/actions/trips"

type Member = { userId: string; displayName: string; role: string }

export function TripActions({
  tripId,
  tripName,
  isOrganizer,
  members,
  myUserId,
}: {
  tripId: string
  tripName: string
  isOrganizer: boolean
  members: Member[]
  myUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"menu" | "rename" | "confirmDelete" | "confirmLeave" | "promoteBeforeLeave">("menu")
  const [name, setName] = useState(tripName)
  const [isPending, startTransition] = useTransition()

  function reset() { setOpen(false); setMode("menu"); setName(tripName) }

  function handleRename() {
    startTransition(async () => {
      await renameTrip(tripId, name)
      reset()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTrip(tripId)
    })
  }

  function handleLeave() {
    startTransition(async () => {
      const result = await leaveTrip(tripId)
      if (result?.error === "promote_first") {
        setMode("promoteBeforeLeave")
      }
    })
  }

  function handlePromoteThenLeave(userId: string) {
    startTransition(async () => {
      await promoteMember(tripId, userId)
      await leaveTrip(tripId)
    })
  }

  const otherMembers = members.filter((m) => m.userId !== myUserId)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
        aria-label="Trip options"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-xs shadow-xl">

            {mode === "menu" && (
              <>
                <h2 className="font-semibold mb-4">Trip options</h2>
                <div className="space-y-2">
                  {isOrganizer && (
                    <button
                      onClick={() => setMode("rename")}
                      className="w-full text-left py-2.5 px-3 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Rename trip
                    </button>
                  )}
                  {!isOrganizer && (
                    <button
                      onClick={() => setMode("confirmLeave")}
                      className="w-full text-left py-2.5 px-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Leave trip
                    </button>
                  )}
                  {isOrganizer && (
                    <button
                      onClick={() => setMode("confirmDelete")}
                      className="w-full text-left py-2.5 px-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete trip
                    </button>
                  )}
                </div>
                <button onClick={reset} className="w-full mt-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </>
            )}

            {mode === "rename" && (
              <>
                <h2 className="font-semibold mb-4">Rename trip</h2>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black mb-4"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename() }}
                />
                <div className="flex gap-2">
                  <button onClick={reset} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={handleRename} disabled={isPending || !name.trim()} className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                    {isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            )}

            {mode === "confirmDelete" && (
              <>
                <h2 className="font-semibold mb-2">Delete trip?</h2>
                <p className="text-sm text-gray-500 mb-5">This will permanently delete &ldquo;{tripName}&rdquo; and all its data.</p>
                <div className="flex gap-2">
                  <button onClick={reset} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={handleDelete} disabled={isPending} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    {isPending ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </>
            )}

            {mode === "confirmLeave" && (
              <>
                <h2 className="font-semibold mb-2">Leave trip?</h2>
                <p className="text-sm text-gray-500 mb-5">You&apos;ll be removed from &ldquo;{tripName}&rdquo; and will need a new invite to rejoin.</p>
                <div className="flex gap-2">
                  <button onClick={reset} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={handleLeave} disabled={isPending} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    {isPending ? "Leaving…" : "Leave"}
                  </button>
                </div>
              </>
            )}

            {mode === "promoteBeforeLeave" && (
              <>
                <h2 className="font-semibold mb-2">Hand off organizer role</h2>
                <p className="text-sm text-gray-500 mb-4">Pick someone to take over as organizer before you leave.</p>
                {otherMembers.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-4">No other members to promote. Delete the trip instead.</p>
                ) : (
                  <ul className="space-y-2 mb-4">
                    {otherMembers.map((m) => (
                      <li key={m.userId}>
                        <button
                          onClick={() => handlePromoteThenLeave(m.userId)}
                          disabled={isPending}
                          className="w-full flex items-center justify-between py-2.5 px-3 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
                        >
                          <span className="font-medium">{m.displayName}</span>
                          <span className="text-xs text-gray-400">Make organizer</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button onClick={reset} className="w-full py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
