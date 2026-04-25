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
  const [customStart, setCustomStart] = useState(currentStart ?? "")
  const [customEnd, setCustomEnd] = useState(currentEnd ?? "")
  const [showCustom, setShowCustom] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isScheduled = !!(currentStart && currentEnd)
  const hasChanged = isScheduled && (customStart !== currentStart || customEnd !== currentEnd)

  const today = new Date().toISOString().slice(0, 10)

  function handlePickWindow(w: Window) {
    startTransition(async () => {
      await scheduleTripDates(tripId, w.dates[0], w.dates[w.dates.length - 1])
      router.refresh()
    })
  }

  function handleSave() {
    if (!customStart || !customEnd) return
    const start = customStart <= customEnd ? customStart : customEnd
    const end = customStart <= customEnd ? customEnd : customStart
    startTransition(async () => {
      await scheduleTripDates(tripId, start, end)
      router.refresh()
    })
  }

  function handleClear() {
    startTransition(async () => {
      await clearTripSchedule(tripId)
      router.refresh()
    })
  }

  // Scheduled: inline editable date inputs — no dialog, no windows list
  if (isScheduled) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Start</label>
            <input
              type="date"
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
        <div className="flex items-center gap-3">
          {hasChanged && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {isPending ? "Saving…" : "Save dates"}
            </button>
          )}
          <button
            onClick={handleClear}
            disabled={isPending}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
          >
            Clear schedule
          </button>
        </div>
      </div>
    )
  }

  // Not scheduled: windows list + optional custom date picker
  return (
    <div className="space-y-3">
      {bestWindows.length > 0 && (
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
      )}

      {!showCustom ? (
        <button
          onClick={() => setShowCustom(true)}
          className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          {bestWindows.length > 0 ? "+ Custom dates" : "Set custom dates →"}
        </button>
      ) : (
        <div className="space-y-2">
          {bestWindows.length > 0 && <p className="text-xs font-medium text-gray-500">Custom range</p>}
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!customStart || !customEnd || isPending}
              className="flex-1 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {isPending ? "Saving…" : "Schedule these dates"}
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="py-2 px-3 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
