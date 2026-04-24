"use client"

import { useState, useTransition } from "react"
import { scheduleTripDates, clearTripSchedule } from "@/lib/actions/trips"

type Window = { dates: string[]; avg: number; coverage: number }

function formatLabel(dates: string[]) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const first = new Date(dates[0] + "T00:00:00").toLocaleDateString("en-US", opts)
  if (dates.length === 1) return first
  const last = new Date(dates[dates.length - 1] + "T00:00:00").toLocaleDateString("en-US", { day: "numeric" })
  return `${first}–${last}`
}

export function ScheduleTrip({
  tripId,
  bestWindows,
  currentStart,
  currentEnd,
  minNights,
}: {
  tripId: string
  bestWindows: Window[]
  currentStart: string | null
  currentEnd: string | null
  minNights?: number
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handlePickWindow(w: Window) {
    setError(null)
    startTransition(async () => {
      const result = await scheduleTripDates(tripId, w.dates[0], w.dates[w.dates.length - 1])
      if (result?.error) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    })
  }

  function handleClear() {
    startTransition(async () => {
      await clearTripSchedule(tripId)
    })
  }

  if (currentStart && currentEnd) {
    const label = formatLabel(
      currentStart === currentEnd ? [currentStart] : [currentStart, currentEnd]
    )
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">Trip scheduled</p>
        </div>
        <button
          onClick={handleClear}
          disabled={isPending}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Schedule trip dates
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl">
            <h2 className="font-semibold mb-1">Pick trip dates</h2>
            <p className="text-sm text-gray-500 mb-4">
              {minNights && minNights > 1
                ? `Showing windows of ${minNights}+ nights based on trip preferences.`
                : "Choose from best windows or select custom dates."}
            </p>

            {bestWindows.length > 0 ? (
              <ul className="space-y-2 mb-4">
                {bestWindows.map((w, i) => {
                  const pct = Math.round(w.coverage * 100)
                  const dotColor =
                    pct >= 100 ? "bg-green-600" :
                    pct >= 75 ? "bg-green-300" :
                    pct >= 50 ? "bg-yellow-300" :
                    "bg-orange-300"
                  return (
                    <li key={i}>
                      <button
                        onClick={() => handlePickWindow(w)}
                        disabled={isPending}
                        className="w-full flex items-center justify-between py-2.5 px-3 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
                          <span className="text-sm font-medium">{formatLabel(w.dates)}</span>
                          <span className="text-xs text-gray-400">{w.dates.length}d</span>
                        </div>
                        <span className="text-xs text-gray-500">{pct}% avail.</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 mb-4">No availability data yet — add dates first.</p>
            )}

            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
