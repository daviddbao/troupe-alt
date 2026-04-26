"use client"

import { useState, useTransition, useEffect } from "react"
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
  const [localStart, setLocalStart] = useState(currentStart ?? "")
  const [localEnd, setLocalEnd] = useState(currentEnd ?? "")
  const [showWindows, setShowWindows] = useState(!currentStart && bestWindows.length > 0)
  const [isPending, startTransition] = useTransition()

  // Sync when server state updates after refresh
  useEffect(() => {
    setLocalStart(currentStart ?? "")
    setLocalEnd(currentEnd ?? "")
    setShowWindows(!currentStart && bestWindows.length > 0)
  }, [currentStart, currentEnd, bestWindows.length])

  const today = new Date().toISOString().slice(0, 10)
  const isScheduled = !!(currentStart && currentEnd)
  const hasValues = !!(localStart && localEnd)
  const hasChanged = localStart !== (currentStart ?? "") || localEnd !== (currentEnd ?? "")

  function handlePickWindow(w: Window) {
    setLocalStart(w.dates[0])
    setLocalEnd(w.dates[w.dates.length - 1])
    setShowWindows(false)
  }

  function handleSave() {
    if (!localStart || !localEnd) return
    const start = localStart <= localEnd ? localStart : localEnd
    const end = localStart <= localEnd ? localEnd : localStart
    startTransition(async () => {
      await scheduleTripDates(tripId, start, end)
      router.refresh()
    })
  }

  function handleClear() {
    setLocalStart("")
    setLocalEnd("")
    setShowWindows(bestWindows.length > 0)
    startTransition(async () => {
      await clearTripSchedule(tripId)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {/* Date inputs — always visible */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Start</label>
          <input
            type="date"
            min={today}
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">End</label>
          <input
            type="date"
            min={localStart || today}
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>

      {/* Action row */}
      {(hasValues && hasChanged) || isScheduled ? (
        <div className="flex items-center gap-3">
          {hasValues && hasChanged && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {isPending ? "Saving…" : isScheduled ? "Save dates" : "Schedule these dates"}
            </button>
          )}
          {isScheduled && !hasChanged && (
            <button
              onClick={handleClear}
              disabled={isPending}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
            >
              Clear schedule
            </button>
          )}
          {isScheduled && hasChanged && (
            <button
              onClick={handleClear}
              disabled={isPending}
              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      ) : null}

      {/* Suggested windows */}
      {bestWindows.length > 0 && (
        <div className="space-y-1.5">
          {showWindows ? (
            <>
              <p className="text-xs text-gray-400">Suggested windows — tap to fill dates</p>
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
              <button
                onClick={() => setShowWindows(false)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Hide suggestions
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowWindows(true)}
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              + Show suggested windows
            </button>
          )}
        </div>
      )}
    </div>
  )
}
