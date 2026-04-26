"use client"

import { useState, useTransition } from "react"
import { saveMemberPreferences, savePreferences } from "@/lib/actions/trips"
import type { TripPreferences } from "@/lib/db/schema"
import { Chevron } from "@/components/ui/collapsible-card"

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

function hasPref(p: MemberPref | undefined) {
  return !!(p?.tripLength || p?.ptoBudget || p?.vibes || p?.weather || p?.notes)
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
  // ── Collapsible ──
  const myPref = initialMemberPrefs.find((p) => p.userId === myUserId)
  const hasAnyPref = hasPref(myPref) || !!(tripPreferences?.geography)
  const [open, setOpen] = useState(hasAnyPref)

  // ── Trip goals (organizer-editable) ──
  const [geography, setGeography] = useState(tripPreferences?.geography ?? "")

  // ── My preferences ──
  const [tripLength, setTripLength] = useState(myPref?.tripLength ?? "")
  const [ptoBudget, setPtoBudget] = useState(myPref?.ptoBudget ?? "")
  const [vibes, setVibes] = useState<string[]>(
    myPref?.vibes ? myPref.vibes.split(",").filter(Boolean) : []
  )
  const [myWeather, setMyWeather] = useState(myPref?.weather ?? "")
  const [notes, setNotes] = useState(myPref?.notes ?? "")
  const [saved, setSaved] = useState(false)
  const [isPending, startT] = useTransition()

  function toggleLocation(v: string) {
    setVibes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }

  function handleSave() {
    startT(async () => {
      const ops: Promise<unknown>[] = [
        saveMemberPreferences(
          tripId,
          tripLength || null,
          ptoBudget || null,
          vibes.length > 0 ? vibes.join(",") : null,
          myWeather || null,
          notes.trim() || null,
        ),
      ]
      if (isOrganizer) {
        ops.push(savePreferences(tripId, {
          geography: geography || undefined,
        }))
      }
      await Promise.all(ops)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const otherPrefs = initialMemberPrefs.filter(
    (p) => p.userId !== myUserId && hasPref(p)
  )

  const chip = (active: boolean) =>
    `px-3 py-1 text-xs font-medium border rounded-full transition-all cursor-pointer ${
      active ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"
    }`

  return (
    <div className="border border-gray-200 rounded-xl">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Preferences</span>
          <span className="text-xs text-gray-400">(optional)</span>
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* ── Trip destination (organizer editable, non-org read-only) ── */}
          {isOrganizer ? (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">Destination</p>
              <input
                type="text"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="Where in the world? (e.g. Southeast Asia, Europe…)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          ) : tripPreferences?.geography ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Destination</p>
              <p className="text-sm text-gray-700">{tripPreferences.geography}</p>
            </div>
          ) : null}

          {(isOrganizer || tripPreferences?.geography) && (
            <div className="border-t border-gray-100" />
          )}

          {/* ── Personal preferences ── */}
          <div className="space-y-3">
            {/* Trip length */}
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">Trip length</p>
              <div className="flex flex-wrap gap-1.5">
                {TRIP_LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTripLength(tripLength === opt.value ? "" : opt.value)}
                    className={chip(tripLength === opt.value)}
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
                    className={chip(ptoBudget === opt.value)}
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
                    className={chip(vibes.includes(opt.value))}
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
                    className={chip(myWeather === opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
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
              {isPending ? "Saving…" : saved ? "Saved ✓" : hasPref(myPref) ? "Update" : "Save preferences"}
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
      )}
    </div>
  )
}
