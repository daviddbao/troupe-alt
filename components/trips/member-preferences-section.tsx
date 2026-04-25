"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { saveMemberPreferences } from "@/lib/actions/trips"
import type { TripPreferences } from "@/lib/db/schema"

const BUDGET_OPTIONS = [
  { value: "budget", label: "Budget", emoji: "💸" },
  { value: "mid", label: "Mid-range", emoji: "✈️" },
  { value: "luxury", label: "Luxury", emoji: "🥂" },
] as const

type MemberPref = {
  userId: string
  displayName: string
  budget: string | null | undefined
  notes: string | null
}

export function MemberPreferencesSection({
  tripId,
  isOrganizer,
  tripPreferences,
  initialMemberPrefs,
  myUserId,
  members,
}: {
  tripId: string
  isOrganizer: boolean
  tripPreferences: TripPreferences | null
  initialMemberPrefs: MemberPref[]
  myUserId: string
  members: { userId: string; displayName: string }[]
}) {
  const myPref = initialMemberPrefs.find((p) => p.userId === myUserId)
  const [budget, setBudget] = useState<string>(myPref?.budget ?? "")
  const [notes, setNotes] = useState(myPref?.notes ?? "")
  const [saved, setSaved] = useState(!!myPref?.budget || !!myPref?.notes)
  const [isPending, startT] = useTransition()

  function handleSave() {
    startT(async () => {
      await saveMemberPreferences(tripId, budget || null, notes.trim() || null)
      setSaved(true)
    })
  }

  const otherPrefs = initialMemberPrefs.filter((p) => p.userId !== myUserId)

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Preferences</h2>
          <span className="text-xs text-gray-400">(optional)</span>
        </div>
      </div>

      {/* Trip-level preferences (organizer) */}
      {(tripPreferences || isOrganizer) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Trip goals</p>
            {isOrganizer && (
              <Link href={`/trips/${tripId}/preferences`} className="text-xs text-gray-400 hover:underline underline-offset-2">
                {tripPreferences ? "Edit" : "Set goals →"}
              </Link>
            )}
          </div>
          {tripPreferences ? (
            <div className="text-xs text-gray-600 space-y-0.5">
              {tripPreferences.geography && <p>📍 {tripPreferences.geography}</p>}
              {tripPreferences.nights && <p>🌙 {tripPreferences.nights} nights</p>}
              {tripPreferences.weather && tripPreferences.weather !== "Any" && <p>☀️ {tripPreferences.weather} weather</p>}
              {tripPreferences.notes && <p className="text-gray-500 italic">{tripPreferences.notes}</p>}
            </div>
          ) : isOrganizer ? (
            <Link
              href={`/trips/${tripId}/preferences`}
              className="block text-center py-1.5 text-xs font-medium text-gray-500 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Set trip goals →
            </Link>
          ) : null}
        </div>
      )}

      {/* Divider when both sections present */}
      {tripPreferences && <div className="border-t border-gray-100" />}

      {/* My preferences */}
      <div className="space-y-2.5">
        <p className="text-xs font-medium text-gray-500">Your preferences</p>

        <div className="flex gap-1.5">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBudget(budget === opt.value ? "" : opt.value)}
              className={`flex-1 py-1.5 text-xs font-medium border rounded-lg transition-all ${
                budget === opt.value
                  ? "bg-black text-white border-black"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Must-haves, deal-breakers, constraints…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />

        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Update my preferences" : "Save my preferences"}
        </button>
      </div>

      {/* Other members' preferences (organizer sees all) */}
      {isOrganizer && otherPrefs.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-500">Group preferences</p>
          {otherPrefs.map((p) => (
            <div key={p.userId} className="flex items-start gap-2">
              <span className="text-xs font-medium text-gray-600 w-20 flex-shrink-0 truncate">{p.displayName}</span>
              <div className="text-xs text-gray-500 space-y-0.5">
                {p.budget && <span className="inline-block bg-gray-100 rounded px-1.5 py-0.5 mr-1">{p.budget}</span>}
                {p.notes && <span>{p.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
