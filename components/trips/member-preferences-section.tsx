"use client"

import { useState, useTransition } from "react"
import { saveMemberPreferences, savePreferences } from "@/lib/actions/trips"
import type { TripPreferences } from "@/lib/db/schema"

const TRIP_LENGTH_OPTIONS = [
  { value: "weekend",  label: "Weekend"  },
  { value: "4-5days",  label: "4–5 days" },
  { value: "1week",    label: "1 week"   },
  { value: "flexible", label: "Flexible" },
]

const PTO_OPTIONS = [
  { value: "none",    label: "None"    },
  { value: "1-2days", label: "1–2 days"},
  { value: "3-5days", label: "3–5 days"},
  { value: "1week+",  label: "1+ week" },
]

const LOCATION_OPTIONS = [
  { value: "beach",     label: "Beach"     },
  { value: "city",      label: "City"      },
  { value: "mountains", label: "Mountains" },
  { value: "culture",   label: "Culture"   },
  { value: "adventure", label: "Adventure" },
  { value: "ski",       label: "Ski"       },
  { value: "relaxed",   label: "Relaxed"   },
]

const WEATHER_OPTIONS = ["Warm", "Cold", "Mild", "Any"] as const

type MemberPref = {
  userId: string
  displayName: string
  tripLength: string | null | undefined
  ptoBudget: string | null | undefined
  vibes: string | null
  weather: string | null | undefined
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
  // ── Trip goals state (organizer-editable) ──
  const [geography, setGeography] = useState(tripPreferences?.geography ?? "")
  const [goalWeather, setGoalWeather] = useState<string>(tripPreferences?.weather ?? "Any")
  const [goalNotes, setGoalNotes] = useState(tripPreferences?.notes ?? "")
  const [goalsSaved, setGoalsSaved] = useState(false)
  const [isGoalsPending, startGoalsT] = useTransition()

  function handleSaveGoals() {
    startGoalsT(async () => {
      await savePreferences(tripId, {
        geography: geography || undefined,
        weather: (goalWeather as TripPreferences["weather"]) || undefined,
        notes: goalNotes || undefined,
      })
      setGoalsSaved(true)
      setTimeout(() => setGoalsSaved(false), 2000)
    })
  }

  // ── My preferences state ──
  const myPref = initialMemberPrefs.find((p) => p.userId === myUserId)
  const [tripLength, setTripLength] = useState(myPref?.tripLength ?? "")
  const [ptoBudget, setPtoBudget] = useState(myPref?.ptoBudget ?? "")
  const [vibes, setVibes] = useState<string[]>(
    myPref?.vibes ? myPref.vibes.split(",").filter(Boolean) : []
  )
  const [myWeather, setMyWeather] = useState(myPref?.weather ?? "")
  const [notes, setNotes] = useState(myPref?.notes ?? "")
  const [prefsSaved, setPrefsSaved] = useState(
    !!(myPref?.tripLength || myPref?.ptoBudget || myPref?.vibes || myPref?.weather || myPref?.notes)
  )
  const [isPending, startT] = useTransition()

  function toggleLocation(v: string) {
    setVibes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }

  function handleSave() {
    startT(async () => {
      await saveMemberPreferences(
        tripId,
        tripLength || null,
        ptoBudget || null,
        vibes.length > 0 ? vibes.join(",") : null,
        myWeather || null,
        notes.trim() || null,
      )
      setPrefsSaved(true)
    })
  }

  const otherPrefs = initialMemberPrefs.filter(
    (p) => p.userId !== myUserId && (p.tripLength || p.ptoBudget || p.vibes || p.weather || p.notes)
  )

  const chipClass = (active: boolean) =>
    `px-3 py-1 text-xs font-medium border rounded-full transition-all ${
      active ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"
    }`

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-700">Preferences</h2>
        <span className="text-xs text-gray-400">(optional)</span>
      </div>

      {/* ── Trip goals (organizer editable, everyone can view) ── */}
      <div className="space-y-2.5">
        <p className="text-xs font-medium text-gray-500">Trip goals</p>

        {isOrganizer ? (
          <>
            <input
              type="text"
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              placeholder="Where in the world? (e.g. Southeast Asia, Europe…)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <div className="flex flex-wrap gap-1.5">
              {WEATHER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setGoalWeather(opt)}
                  className={chipClass(goalWeather === opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              value={goalNotes}
              onChange={(e) => setGoalNotes(e.target.value)}
              rows={2}
              placeholder="Notes for the group (must-haves, themes, vibe…)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
            <button
              onClick={handleSaveGoals}
              disabled={isGoalsPending}
              className="py-1.5 px-4 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {isGoalsPending ? "Saving…" : goalsSaved ? "Saved ✓" : "Save goals"}
            </button>
          </>
        ) : tripPreferences?.geography || tripPreferences?.notes ? (
          <div className="space-y-1 text-sm text-gray-700">
            {tripPreferences.geography && <p>{tripPreferences.geography}</p>}
            {tripPreferences.weather && tripPreferences.weather !== "Any" && (
              <p className="text-xs text-gray-500">{tripPreferences.weather} weather</p>
            )}
            {tripPreferences.notes && (
              <p className="text-xs text-gray-500 italic">{tripPreferences.notes}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No trip goals set yet.</p>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* ── My preferences ── */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-500">Your preferences</p>

        {/* Trip length */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">Trip length</p>
          <div className="flex flex-wrap gap-1.5">
            {TRIP_LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTripLength(tripLength === opt.value ? "" : opt.value)}
                className={chipClass(tripLength === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* PTO budget */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">PTO budget</p>
          <div className="flex flex-wrap gap-1.5">
            {PTO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPtoBudget(ptoBudget === opt.value ? "" : opt.value)}
                className={chipClass(ptoBudget === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">Location</p>
          <div className="flex flex-wrap gap-1.5">
            {LOCATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleLocation(opt.value)}
                className={chipClass(vibes.includes(opt.value))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Weather */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">Weather</p>
          <div className="flex flex-wrap gap-1.5">
            {WEATHER_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setMyWeather(myWeather === opt ? "" : opt)}
                className={chipClass(myWeather === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Other */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Other constraints or notes…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />

        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : prefsSaved ? "Update" : "Save preferences"}
        </button>
      </div>

      {/* ── Other members (organizer only) ── */}
      {isOrganizer && otherPrefs.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-gray-500">Group</p>
          {otherPrefs.map((p) => (
            <div key={p.userId} className="flex items-start gap-2.5">
              <span className="text-xs font-medium text-gray-600 w-20 flex-shrink-0 truncate">{p.displayName}</span>
              <div className="flex flex-wrap gap-1 text-xs">
                {p.tripLength && <span className="bg-gray-100 rounded px-1.5 py-0.5">{p.tripLength}</span>}
                {p.ptoBudget && <span className="bg-gray-100 rounded px-1.5 py-0.5">{p.ptoBudget} PTO</span>}
                {p.vibes?.split(",").filter(Boolean).map((v) => (
                  <span key={v} className="bg-gray-100 rounded px-1.5 py-0.5">{v}</span>
                ))}
                {p.weather && <span className="bg-gray-100 rounded px-1.5 py-0.5">{p.weather}</span>}
                {p.notes && <span className="text-gray-400 italic">{p.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
