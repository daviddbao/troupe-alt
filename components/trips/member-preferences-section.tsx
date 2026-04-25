"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { saveMemberPreferences } from "@/lib/actions/trips"
import type { TripPreferences } from "@/lib/db/schema"

const BUDGET_OPTIONS = [
  { value: "budget",  label: "Budget"    },
  { value: "mid",     label: "Mid-range" },
  { value: "luxury",  label: "Luxury"    },
] as const

const VIBE_OPTIONS = [
  { value: "beach",     label: "Beach"     },
  { value: "city",      label: "City"      },
  { value: "mountains", label: "Mountains" },
  { value: "culture",   label: "Culture"   },
  { value: "adventure", label: "Adventure" },
  { value: "ski",       label: "Ski"       },
  { value: "relaxed",   label: "Relaxed"   },
] as const

type MemberPref = {
  userId: string
  displayName: string
  budget: string | null | undefined
  vibes: string | null
  notes: string | null
}

export function MemberPreferencesSection({
  tripId,
  isOrganizer,
  tripPreferences,
  initialMemberPrefs,
  myUserId,
}: {
  tripId: string
  isOrganizer: boolean
  tripPreferences: TripPreferences | null
  initialMemberPrefs: MemberPref[]
  myUserId: string
  members: { userId: string; displayName: string }[]
}) {
  const myPref = initialMemberPrefs.find((p) => p.userId === myUserId)
  const [budget, setBudget] = useState(myPref?.budget ?? "")
  const [vibes, setVibes] = useState<string[]>(myPref?.vibes ? myPref.vibes.split(",").filter(Boolean) : [])
  const [notes, setNotes] = useState(myPref?.notes ?? "")
  const [saved, setSaved] = useState(!!myPref?.budget || !!myPref?.vibes || !!myPref?.notes)
  const [isPending, startT] = useTransition()

  function toggleVibe(v: string) {
    setVibes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }

  function handleSave() {
    startT(async () => {
      await saveMemberPreferences(
        tripId,
        budget || null,
        vibes.length > 0 ? vibes.join(",") : null,
        notes.trim() || null,
      )
      setSaved(true)
    })
  }

  const otherPrefs = initialMemberPrefs.filter((p) => p.userId !== myUserId && (p.budget || p.vibes || p.notes))

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Preferences</h2>
          <span className="text-xs text-gray-400">(optional)</span>
        </div>
      </div>

      {/* Trip goals — organizer-set, compact */}
      {(tripPreferences || isOrganizer) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Trip goals</p>
            {isOrganizer && (
              <Link href={`/trips/${tripId}/preferences`} className="text-xs text-gray-400 hover:underline underline-offset-2">
                {tripPreferences ? "Edit" : "Set →"}
              </Link>
            )}
          </div>
          {tripPreferences ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
              {tripPreferences.geography && <span>📍 {tripPreferences.geography}</span>}
              {tripPreferences.nights && <span>🌙 {tripPreferences.nights}n</span>}
              {tripPreferences.weather && tripPreferences.weather !== "Any" && <span>{tripPreferences.weather}</span>}
              {tripPreferences.notes && <span className="text-gray-400 italic w-full">{tripPreferences.notes}</span>}
            </div>
          ) : isOrganizer ? (
            <Link href={`/trips/${tripId}/preferences`} className="block text-center py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Set trip goals →
            </Link>
          ) : null}
        </div>
      )}

      {tripPreferences && <div className="border-t border-gray-100" />}

      {/* My preferences */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-500">Your preferences</p>

        {/* Budget */}
        <div className="flex gap-1.5">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBudget(budget === opt.value ? "" : opt.value)}
              className={`flex-1 py-1.5 text-xs font-medium border rounded-lg transition-all ${
                budget === opt.value ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Vibe chips */}
        <div className="flex flex-wrap gap-1.5">
          {VIBE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleVibe(opt.value)}
              className={`px-3 py-1 text-xs font-medium border rounded-full transition-all ${
                vibes.includes(opt.value) ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Notes */}
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
          {isPending ? "Saving…" : saved ? "Update" : "Save preferences"}
        </button>
      </div>

      {/* Other members' prefs — organizer only */}
      {isOrganizer && otherPrefs.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-500">Group</p>
          {otherPrefs.map((p) => (
            <div key={p.userId} className="flex items-start gap-2.5">
              <span className="text-xs font-medium text-gray-600 w-20 flex-shrink-0 truncate">{p.displayName}</span>
              <div className="flex flex-wrap gap-1 text-xs">
                {p.budget && <span className="bg-gray-100 rounded px-1.5 py-0.5">{p.budget}</span>}
                {p.vibes?.split(",").filter(Boolean).map((v) => (
                  <span key={v} className="bg-gray-100 rounded px-1.5 py-0.5">{v}</span>
                ))}
                {p.notes && <span className="text-gray-400 italic">{p.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
