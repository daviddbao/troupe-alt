"use client"

import { useState, useTransition, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DayPicker } from "react-day-picker"
import { setAvailabilityDates } from "@/lib/actions/trips"
import "react-day-picker/style.css"

// Dynamic holiday calculation — works for any year
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  return new Date(year, month, 1 + diff + (n - 1) * 7)
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return new Date(year, month, last.getDate() - diff)
}

function holidayWeekend(holiday: Date, today: Date): string[] {
  if (holiday < today) return []
  const dates: string[] = []
  for (let offset = -2; offset <= 1; offset++) {
    const d = new Date(holiday)
    d.setDate(d.getDate() + offset)
    if (d >= today) dates.push(toIso(d))
  }
  return dates
}

function buildHolidays(): { label: string; dates: string[] }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y = today.getFullYear()
  const result: { label: string; dates: string[] }[] = []
  const seen = new Set<string>()

  for (const year of [y, y + 1]) {
    const candidates = [
      { label: "Memorial Day", date: lastWeekday(year, 4, 1) },
      { label: "4th of July",  date: new Date(year, 6, 4) },
      { label: "Labor Day",    date: nthWeekday(year, 8, 1, 1) },
      { label: "Thanksgiving", date: nthWeekday(year, 10, 4, 4) },
      { label: "Christmas",    date: new Date(year, 11, 25) },
    ]
    for (const { label, date } of candidates) {
      if (!seen.has(label)) {
        const dates = holidayWeekend(date, today)
        if (dates.length > 0) { result.push({ label, dates }); seen.add(label) }
      }
    }
  }
  return result
}

const HOLIDAYS = buildHolidays()

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fromIso(s: string): Date {
  const [y, m, day] = s.split("-").map(Number)
  return new Date(y, m - 1, day)
}

function getDatesBetween(a: string, b: string): string[] {
  const [start, end] = a <= b ? [a, b] : [b, a]
  const dates: string[] = []
  const cur = fromIso(start)
  const endDate = fromIso(end)
  while (cur <= endDate) {
    dates.push(toIso(new Date(cur)))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

type Props = { tripId: string; savedDates: string[] }

export function AvailabilityCalendar({ tripId, savedDates }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(savedDates)
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [eraseMode, setEraseMode] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [flashDates, setFlashDates] = useState<string[]>([])
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  function handleDayClick(day: Date) {
    const iso = toIso(day)
    if (day < today) return

    if (eraseMode) {
      if (rangeAnchor === null) {
        setRangeAnchor(iso)
      } else if (rangeAnchor === iso) {
        setSelected((prev) => prev.filter((d) => d !== iso))
        setRangeAnchor(null)
        setHoverDate(null)
      } else {
        const dates = getDatesBetween(rangeAnchor, iso)
        setSelected((prev) => prev.filter((d) => !dates.includes(d)))
        setRangeAnchor(null)
        setHoverDate(null)
      }
      return
    }

    if (rangeAnchor === null) {
      setRangeAnchor(iso)
    } else if (rangeAnchor === iso) {
      setSelected((prev) =>
        prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
      )
      setRangeAnchor(null)
      setHoverDate(null)
    } else {
      const dates = getDatesBetween(rangeAnchor, iso).filter((d) => fromIso(d) >= today)
      setSelected((prev) => {
        const next = [...prev]
        for (const d of dates) if (!next.includes(d)) next.push(d)
        return next
      })
      setRangeAnchor(null)
      setHoverDate(null)
    }
  }

  function handleDayMouseEnter(day: Date) {
    if (rangeAnchor !== null) setHoverDate(toIso(day))
  }

  const previewRange = useMemo(() => {
    if (!rangeAnchor || !hoverDate) return { all: [], start: null, end: null }
    const all = getDatesBetween(rangeAnchor, hoverDate).filter((d) => fromIso(d) >= today)
    const sorted = [...all].sort()
    return { all, start: sorted[0] ?? null, end: sorted[sorted.length - 1] ?? null }
  }, [rangeAnchor, hoverDate, today])

  const previewDates = useMemo(() => {
    if (eraseMode) return []
    return previewRange.all
      .filter((d) => !selected.includes(d))
      .map(fromIso)
  }, [eraseMode, previewRange, selected])

  const previewStartDate = useMemo(() => {
    if (eraseMode || !previewRange.start) return []
    return [fromIso(previewRange.start)]
  }, [eraseMode, previewRange])

  const previewEndDate = useMemo(() => {
    if (eraseMode || !previewRange.end || previewRange.end === previewRange.start) return []
    return [fromIso(previewRange.end)]
  }, [eraseMode, previewRange])

  const erasePreviewDates = useMemo(() => {
    if (!eraseMode || !rangeAnchor || !hoverDate) return []
    return getDatesBetween(rangeAnchor, hoverDate)
      .filter((d) => selected.includes(d))
      .map(fromIso)
  }, [eraseMode, rangeAnchor, hoverDate, selected])

  function addHoliday(dates: string[]) {
    const valid = dates.filter((d) => fromIso(d) >= today)
    const newDates = valid.filter((d) => !selected.includes(d))
    setSelected((prev) => {
      const next = [...prev]
      for (const d of valid) if (!next.includes(d)) next.push(d)
      return next
    })
    setRangeAnchor(null)

    if (newDates.length > 0) {
      if (flashTimer.current) clearTimeout(flashTimer.current)
      setFlashDates(newDates)
      flashTimer.current = setTimeout(() => setFlashDates([]), 1400)
    }
    showToast(`Added ${valid.length} date${valid.length !== 1 ? "s" : ""}`)
  }

  function cancelRange() {
    setRangeAnchor(null)
    setHoverDate(null)
  }

  function handleClearAll() {
    setSelected([])
    setRangeAnchor(null)
    setHoverDate(null)
    setShowClearConfirm(false)
  }

  function handleSave() {
    startTransition(async () => {
      await setAvailabilityDates(tripId, selected)
      showToast("Availability saved!")
      setTimeout(() => router.push(`/trips/${tripId}`), 1200)
    })
  }

  // Group selected dates by month for summary panel
  const datesByMonth = useMemo(() => {
    const sorted = [...selected].sort()
    const groups: { key: string; label: string; dates: string[] }[] = []
    for (const d of sorted) {
      const [y, m] = d.split("-").map(Number)
      const key = `${y}-${String(m).padStart(2, "0")}`
      const last = groups[groups.length - 1]
      if (last && last.key === key) {
        last.dates.push(d)
      } else {
        const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        groups.push({ key, label, dates: [d] })
      }
    }
    return groups
  }, [selected])

  const visibleHolidays = HOLIDAYS.filter((h) => h.dates.length > 0)
  const selectedDates = selected.map(fromIso)
  const anchorDates = rangeAnchor ? [fromIso(rangeAnchor)] : []
  const flashDateObjs = flashDates.map(fromIso)

  return (
    <div className="space-y-4">
      {/* Holiday chips */}
      {visibleHolidays.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
            {visibleHolidays.map((h) => (
              <button
                key={h.label}
                onClick={() => addHoliday(h.dates)}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-full hover:border-gray-400 hover:bg-gray-50 transition-all whitespace-nowrap"
              >
                + {h.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two-column layout on md+ */}
      <div className="md:grid md:grid-cols-[1fr_220px] md:gap-5 space-y-4 md:space-y-0 md:items-start">
        {/* Left: calendar + controls */}
        <div className="space-y-3">
          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEraseMode((e) => !e); cancelRange() }}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  eraseMode
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 20H7L3 16l11-11 6 6-1.5 1.5" /><path d="M6.5 17.5l4-4" />
                </svg>
                {eraseMode ? "Erasing" : "Erase mode"}
              </button>

              {rangeAnchor && (
                <button
                  onClick={cancelRange}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            {selected.length > 0 && !rangeAnchor && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Range hint */}
          <p className="text-xs text-center text-gray-400">
            {rangeAnchor
              ? (eraseMode ? "Click end date to erase range" : "Click end date to fill range")
              : "Click a date to start — click another to fill the range"}
          </p>

          {/* Calendar */}
          <div
            data-testid="availability-calendar"
            className={`border rounded-xl overflow-hidden transition-colors ${
              rangeAnchor ? "border-gray-400" : "border-gray-200"
            }`}
          >
            <DayPicker
              mode="multiple"
              selected={selectedDates}
              onDayClick={handleDayClick}
              onDayMouseEnter={handleDayMouseEnter}
              onDayMouseLeave={() => setHoverDate(null)}
              modifiers={{
                anchor: anchorDates,
                preview: previewDates,
                previewStart: previewStartDate,
                previewEnd: previewEndDate,
                erasePreview: eraseMode ? erasePreviewDates : [],
                flash: flashDateObjs,
              }}
              modifiersClassNames={{
                anchor: "[&>button]:!ring-2 [&>button]:!ring-black [&>button]:!ring-offset-1",
                preview: "!bg-blue-100 [&>button]:!bg-transparent [&>button]:!text-blue-900 [&>button]:!rounded-none [&>button]:!w-full",
                previewStart: "!bg-blue-100 [&>button]:!bg-transparent [&>button]:!text-blue-900 [&>button]:!rounded-r-none [&>button]:!w-full",
                previewEnd: "!bg-blue-100 [&>button]:!bg-transparent [&>button]:!text-blue-900 [&>button]:!rounded-l-none [&>button]:!w-full",
                erasePreview: "[&>button]:!bg-red-100 [&>button]:!text-red-700",
                flash: "[&>button]:!bg-amber-300 [&>button]:!text-amber-900",
              }}
              disabled={{ before: new Date() }}
              numberOfMonths={1}
              showOutsideDays
              classNames={{
                root: "p-3 w-full",
                month_caption: "flex justify-center items-center py-1 mb-2 font-semibold text-sm",
                nav: "flex items-center justify-between mb-2",
                button_previous: "p-1 rounded hover:bg-gray-100",
                button_next: "p-1 rounded hover:bg-gray-100",
                month_grid: "w-full",
                weekdays: "grid grid-cols-7 mb-1",
                weeks: "w-full",
                week: "grid grid-cols-7",
                weekday: "text-center text-xs text-gray-400 py-1 font-normal",
                day: "text-center p-0",
                day_button: "w-9 h-9 mx-auto rounded-full text-sm hover:bg-gray-100 transition-colors flex items-center justify-center",
                selected: "[&>button]:!bg-black [&>button]:!text-white [&>button]:!hover:bg-gray-800",
                disabled: "opacity-30 cursor-not-allowed [&>button]:cursor-not-allowed",
                today: "[&>button]:font-bold",
                outside: "opacity-40",
              }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isPending || rangeAnchor !== null}
            className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : rangeAnchor ? "Finish range first" : "Save availability"}
          </button>
        </div>

        {/* Right: summary panel */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {selected.length === 0 ? "No dates selected" : `${selected.length} day${selected.length !== 1 ? "s" : ""} selected`}
            </p>
          </div>

          {selected.length === 0 ? (
            <p className="text-xs text-gray-400 leading-relaxed">
              Click dates on the calendar to mark when you&apos;re free. Use the holiday chips above to quickly add long weekends.
            </p>
          ) : (
            <div className="space-y-3">
              {datesByMonth.map(({ key, label, dates }) => (
                <div key={key}>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
                  <div className="flex flex-wrap gap-1">
                    {dates.map((d) => {
                      const dt = new Date(d + "T00:00:00")
                      const day = dt.getDate()
                      const weekday = dt.toLocaleDateString("en-US", { weekday: "short" })
                      return (
                        <span
                          key={d}
                          className="text-xs bg-gray-100 rounded-md px-1.5 py-0.5 text-gray-700 font-medium"
                        >
                          {weekday} {day}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clear confirm dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-xs shadow-xl">
            <h2 className="font-semibold mb-2">Clear all dates?</h2>
            <p className="text-sm text-gray-500 mb-5">This will remove all your selected dates for this trip.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-900 text-white text-sm rounded-full shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
