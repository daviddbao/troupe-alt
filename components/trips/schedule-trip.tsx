"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
}: {
  tripId: string
  bestWindows: Window[]
  currentStart: string | null
  currentEnd: string | null
  minNights?: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState(currentStart ?? "")
  const [customEnd, setCustomEnd] = useState(currentEnd ?? "")
  const [isPending, startTransition] = useTransition()

  function handlePickWindow(w: Window) {
    startTransition(async () => {
      await scheduleTripDates(tripId, w.dates[0], w.dates[w.dates.length - 1])
      setOpen(false)
      router.refresh()
    })
  }

  function handleCustomSchedule() {
    if (!customStart || !customEnd) return
    const start = customStart <= customEnd ? customStart : customEnd
    const end = customStart <= customEnd ? customEnd : customStart
    startTransition(async () => {
      await scheduleTripDates(tripId, start, end)
      setOpen(false)
      router.refresh()
    })
  }

  function handleClear() {
    startTransition(async () => {
      await clearTripSchedule(tripId)
      setOpen(false)
      router.refresh()
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {currentStart && currentEnd ? (
        <button
          onClick={() => { setCustomStart(currentStart); setCustomEnd(currentEnd); setOpen(true) }}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          Change dates
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Schedule trip dates
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl space-y-4">
            <h2 className="font-semibold">Pick trip dates</h2>

            {/* Custom date range */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Custom range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Start</label>
                  <input
                    type="date"
                    min={today}
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">End</label>
                  <input
                    type="date"
                    min={customStart || today}
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>
              <button
                onClick={handleCustomSchedule}
                disabled={!customStart || !customEnd || isPending}
                className="w-full py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                {isPending ? "Saving…" : "Schedule these dates"}
              </button>
            </div>

            {/* Best windows */}
            {bestWindows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Suggested windows</p>
                <ul className="space-y-1.5">
                  {bestWindows.map((w, i) => {
                    const pct = Math.round(w.coverage * 100)
                    const dotColor =
                      pct >= 100 ? "bg-green-600" :
                      pct >= 75  ? "bg-green-400" :
                      pct >= 50  ? "bg-yellow-400" :
                      "bg-orange-400"
                    return (
                      <li key={i}>
                        <button
                          onClick={() => handlePickWindow(w)}
                          disabled={isPending}
                          className="w-full flex items-center justify-between py-2 px-3 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50 text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                            <span className="text-sm font-medium">{formatLabel(w.dates)}</span>
                            <span className="text-xs text-gray-400">{w.dates.length}d</span>
                          </div>
                          <span className="text-xs text-gray-500">{pct}% avail.</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {currentStart && (
                <button
                  onClick={handleClear}
                  disabled={isPending}
                  className="flex-1 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Clear schedule
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
