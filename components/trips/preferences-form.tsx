"use client"

import { useState, useTransition } from "react"
import { savePreferences } from "@/lib/actions/trips"
import type { TripPreferences } from "@/lib/db/schema"
import { useRouter } from "next/navigation"

const WEATHER_OPTIONS = ["Warm", "Cold", "Mild", "Any"] as const

export function PreferencesForm({
  tripId,
  saved,
  isOrganizer,
}: {
  tripId: string
  saved: TripPreferences
  isOrganizer: boolean
}) {
  const [nights, setNights] = useState(saved.nights?.toString() ?? "")
  const [ptoDays, setPtoDays] = useState(saved.ptoDays?.toString() ?? "")
  const [geography, setGeography] = useState(saved.geography ?? "")
  const [weather, setWeather] = useState<TripPreferences["weather"]>(
    saved.weather ?? "Any"
  )
  const [notes, setNotes] = useState(saved.notes ?? "")
  const [toast, setToast] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    startTransition(async () => {
      await savePreferences(tripId, {
        nights: nights ? Number(nights) : undefined,
        ptoDays: ptoDays ? Number(ptoDays) : undefined,
        geography: geography || undefined,
        weather,
        notes: notes || undefined,
      })
      setToast(true)
      setTimeout(() => {
        setToast(false)
        router.push(`/trips/${tripId}`)
      }, 1200)
    })
  }

  return (
    <div className="space-y-5">
      {!isOrganizer && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
          Only the organizer can edit preferences.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Trip length (nights)</label>
          <input
            type="number"
            min={1}
            value={nights}
            onChange={(e) => setNights(e.target.value)}
            disabled={!isOrganizer}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
            placeholder="e.g. 4"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">PTO budget (days)</label>
          <input
            type="number"
            min={0}
            value={ptoDays}
            onChange={(e) => setPtoDays(e.target.value)}
            disabled={!isOrganizer}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
            placeholder="e.g. 3"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Where in the world?</label>
        <input
          type="text"
          value={geography}
          onChange={(e) => setGeography(e.target.value)}
          disabled={!isOrganizer}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          placeholder="e.g. Southeast Asia, Europe, anywhere"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Weather preference</label>
        <div className="flex gap-2 flex-wrap">
          {WEATHER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => isOrganizer && setWeather(opt)}
              disabled={!isOrganizer}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all disabled:cursor-not-allowed ${
                weather === opt
                  ? "bg-black text-white border-black"
                  : "border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          disabled={!isOrganizer}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          placeholder="Anything else the group should know…"
        />
      </div>

      {isOrganizer && (
      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Saving…" : "Save preferences"}
      </button>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-900 text-white text-sm rounded-full shadow-lg z-50 pointer-events-none">
          Saved!
        </div>
      )}
    </div>
  )
}
