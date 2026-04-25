"use client"

import { useState, useTransition, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DayPicker } from "react-day-picker"
import { setAvailabilityDates } from "@/lib/actions/trips"
import "react-day-picker/style.css"

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
  for (let offset = -3; offset <= 3; offset++) {
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

type Props = {
  tripId: string
  savedDates: string[]
  onSaved?: () => void
  dateCounts?: Record<string, number>
  memberCount?: number
}

export function AvailabilityCalendar({ tripId, savedDates, onSaved, dateCounts, memberCount }: Props) {
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
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drag state — refs only (no re-renders)
  const isDraggingRef = useRef(false)
  const dragAnchorRef = useRef<string | null>(null)
  const hasDragMovedRef = useRef(false)
  const dragCommittedRef = useRef(false)

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

  function flash(dates: string[]) {
    if (dates.length === 0) return
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlashDates(dates)
    flashTimer.current = setTimeout(() => setFlashDates([]), 1400)
  }

  // — Click handler (two-click range OR single toggle) —
  function handleDayClick(day: Date) {
    if (dragCommittedRef.current) {
      dragCommittedRef.current = false
      return
    }
    const iso = toIso(day)
    if (day < today) return

    if (eraseMode) {
      if (rangeAnchor === null) {
        setRangeAnchor(iso)
      } else if (rangeAnchor === iso) {
        const next = selected.filter((d) => d !== iso)
        setSelected(next)
        setRangeAnchor(null)
        setHoverDate(null)
        scheduleAutoSave(next)
      } else {
        const dates = getDatesBetween(rangeAnchor, iso)
        const next = selected.filter((d) => !dates.includes(d))
        setSelected(next)
        setRangeAnchor(null)
        setHoverDate(null)
        scheduleAutoSave(next)
      }
      return
    }

    if (rangeAnchor === null) {
      // First tap — set anchor, single-tap toggle will fire on second tap to same date
      setRangeAnchor(iso)
    } else if (rangeAnchor === iso) {
      const next = selected.includes(iso) ? selected.filter((d) => d !== iso) : [...selected, iso]
      setSelected(next)
      setRangeAnchor(null)
      setHoverDate(null)
      scheduleAutoSave(next)
    } else {
      const dates = getDatesBetween(rangeAnchor, iso).filter((d) => fromIso(d) >= today)
      const next = [...selected]
      for (const d of dates) if (!next.includes(d)) next.push(d)
      setSelected(next)
      setRangeAnchor(null)
      setHoverDate(null)
      scheduleAutoSave(next)
    }
  }

  // — Hover: always track, also detects drag movement —
  function handleDayMouseEnter(day: Date) {
    const iso = toIso(day)
    setHoverDate(iso)

    // First movement during drag — set the visual anchor for preview
    if (isDraggingRef.current && dragAnchorRef.current && !hasDragMovedRef.current && iso !== dragAnchorRef.current) {
      hasDragMovedRef.current = true
      setRangeAnchor(dragAnchorRef.current)
    }
  }

  // — Drag pointer events —
  function handleCalendarPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    if (e.pointerType === "touch") return  // tap-to-toggle handles mobile
    const target = e.target as HTMLElement
    if (!target.closest("td")) return
    if (hoverDate && fromIso(hoverDate) >= today) {
      isDraggingRef.current = true
      dragAnchorRef.current = hoverDate
      hasDragMovedRef.current = false
      dragCommittedRef.current = false
    }
  }

  function handleCalendarPointerUp() {
    if (!isDraggingRef.current) return

    if (hasDragMovedRef.current && dragAnchorRef.current && hoverDate && dragAnchorRef.current !== hoverDate) {
      const dates = getDatesBetween(dragAnchorRef.current, hoverDate).filter((d) => fromIso(d) >= today)
      let next: string[]
      if (eraseMode) {
        next = selected.filter((d) => !dates.includes(d))
      } else {
        next = [...selected]
        for (const d of dates) if (!next.includes(d)) next.push(d)
      }
      setSelected(next)
      setRangeAnchor(null)
      setHoverDate(null)
      dragCommittedRef.current = true
      scheduleAutoSave(next)
    }

    isDraggingRef.current = false
    hasDragMovedRef.current = false
    dragAnchorRef.current = null
  }

  // — Preview range computation —
  const previewRange = useMemo(() => {
    if (!rangeAnchor || !hoverDate) return { all: [], start: null, end: null }
    const all = getDatesBetween(rangeAnchor, hoverDate).filter((d) => fromIso(d) >= today)
    const sorted = [...all].sort()
    return { all, start: sorted[0] ?? null, end: sorted[sorted.length - 1] ?? null }
  }, [rangeAnchor, hoverDate, today])

  const previewDates = useMemo(() => {
    if (eraseMode) return []
    return previewRange.all.filter((d) => !selected.includes(d)).map(fromIso)
  }, [eraseMode, previewRange, selected])

  const previewStartDate = useMemo(() => {
    if (eraseMode) return []
    const unselected = previewRange.all.filter((d) => !selected.includes(d)).sort()
    return unselected.length > 0 ? [fromIso(unselected[0])] : []
  }, [eraseMode, previewRange, selected])

  const previewEndDate = useMemo(() => {
    if (eraseMode) return []
    const unselected = previewRange.all.filter((d) => !selected.includes(d)).sort()
    if (unselected.length <= 1) return []
    return [fromIso(unselected[unselected.length - 1])]
  }, [eraseMode, previewRange, selected])

  const erasePreviewDates = useMemo(() => {
    if (!eraseMode || !rangeAnchor || !hoverDate) return []
    return getDatesBetween(rangeAnchor, hoverDate)
      .filter((d) => selected.includes(d))
      .map(fromIso)
  }, [eraseMode, rangeAnchor, hoverDate, selected])

  // — Holiday toggle (adds if not all selected, removes if all selected) —
  function toggleHoliday(dates: string[]) {
    const valid = dates.filter((d) => fromIso(d) >= today)
    const allSelected = valid.length > 0 && valid.every((d) => selected.includes(d))
    setRangeAnchor(null)
    let next: string[]
    if (allSelected) {
      next = selected.filter((d) => !valid.includes(d))
      setSelected(next)
      showToast(`Removed ${valid.length} date${valid.length !== 1 ? "s" : ""}`)
    } else {
      const newDates = valid.filter((d) => !selected.includes(d))
      next = [...selected]
      for (const d of valid) if (!next.includes(d)) next.push(d)
      setSelected(next)
      flash(newDates)
      showToast(`Added ${newDates.length} date${newDates.length !== 1 ? "s" : ""}`)
    }
    scheduleAutoSave(next)
  }

  function cancelRange() {
    setRangeAnchor(null)
    setHoverDate(null)
  }

  function handleClearAll() {
    const next: string[] = []
    setSelected(next)
    setRangeAnchor(null)
    setHoverDate(null)
    setShowClearConfirm(false)
    scheduleAutoSave(next)
  }

  function scheduleAutoSave(dates: string[]) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      startTransition(async () => {
        await setAvailabilityDates(tripId, dates)
        showToast("Saved!")
        if (onSaved) onSaved()
      })
    }, 1200)
  }

  const visibleHolidays = HOLIDAYS.filter((h) => h.dates.length > 0)
  const selectedDates = selected.map(fromIso)
  const anchorDates = rangeAnchor ? [fromIso(rangeAnchor)] : []
  const flashDateObjs = flashDates.map(fromIso)

  // Aggregate overlay (when group data is provided)
  const aggFull: Date[] = [], aggHigh: Date[] = [], aggMed: Date[] = [], aggLow: Date[] = []
  if (dateCounts && memberCount) {
    for (const [date, count] of Object.entries(dateCounts)) {
      const cov = count / memberCount
      const d = fromIso(date)
      if (cov >= 1.0) aggFull.push(d)
      else if (cov >= 0.75) aggHigh.push(d)
      else if (cov >= 0.5) aggMed.push(d)
      else if (cov >= 0.25) aggLow.push(d)
    }
  }

  return (
    <div className="space-y-3">
      {/* Holiday chips */}
      {visibleHolidays.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
            {visibleHolidays.map((h) => {
              const valid = h.dates.filter((d) => fromIso(d) >= today)
              const allSel = valid.length > 0 && valid.every((d) => selected.includes(d))
              return (
                <button
                  key={h.label}
                  onClick={() => toggleHoliday(h.dates)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-full transition-all whitespace-nowrap ${
                    allSel ? "border-gray-400 bg-gray-100 text-gray-700" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  {allSel ? "✓ " : "+ "}{h.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEraseMode((e) => !e); cancelRange() }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
              eraseMode ? "bg-red-50 border-red-200 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20H7L3 16l11-11 6 6-1.5 1.5" /><path d="M6.5 17.5l4-4" />
            </svg>
            {eraseMode ? "Erasing" : "Erase"}
          </button>
          {rangeAnchor && (
            <button onClick={cancelRange} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              Cancel
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <span className="text-xs text-gray-400">{selected.length} day{selected.length !== 1 ? "s" : ""}</span>
          )}
          {selected.length > 0 && !rangeAnchor && (
            <button onClick={() => setShowClearConfirm(true)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Range hint — only shown when active */}
      {rangeAnchor && (
        <p className="text-xs text-center text-gray-500">
          {eraseMode ? "Tap end date to erase range" : "Tap end date to fill range"}
        </p>
      )}

      {/* Calendar */}
      <div
        data-testid="availability-calendar"
        className={`border rounded-xl overflow-hidden transition-colors select-none ${rangeAnchor ? "border-gray-400" : "border-gray-200"}`}
        onPointerDown={handleCalendarPointerDown}
        onPointerUp={handleCalendarPointerUp}
        onPointerLeave={handleCalendarPointerUp}
      >
        <DayPicker
          mode="multiple"
          selected={selectedDates}
          onDayClick={handleDayClick}
          onDayMouseEnter={handleDayMouseEnter}
          onDayMouseLeave={() => { if (!isDraggingRef.current) setHoverDate(null) }}
          modifiers={{ anchor: anchorDates, preview: previewDates, previewStart: previewStartDate, previewEnd: previewEndDate, erasePreview: eraseMode ? erasePreviewDates : [], flash: flashDateObjs, aggFull, aggHigh, aggMed, aggLow }}
          modifiersClassNames={{
            anchor: "[&>button]:!ring-2 [&>button]:!ring-black [&>button]:!ring-offset-1",
            preview: "!bg-blue-100 [&>button]:!bg-transparent [&>button]:!text-blue-900 [&>button]:!rounded-none [&>button]:!w-full",
            previewStart: "!bg-blue-100 [&>button]:!bg-transparent [&>button]:!text-blue-900 [&>button]:!rounded-r-none [&>button]:!w-full",
            previewEnd: "!bg-blue-100 [&>button]:!bg-transparent [&>button]:!text-blue-900 [&>button]:!rounded-l-none [&>button]:!w-full",
            erasePreview: "[&>button]:!bg-red-100 [&>button]:!text-red-700",
            flash: "[&>button]:!bg-amber-300 [&>button]:!text-amber-900",
            aggFull: "[&>button]:ring-2 [&>button]:ring-green-500 [&>button]:ring-offset-1",
            aggHigh: "[&>button]:ring-2 [&>button]:ring-green-300 [&>button]:ring-offset-1",
            aggMed:  "[&>button]:ring-2 [&>button]:ring-yellow-300 [&>button]:ring-offset-1",
            aggLow:  "[&>button]:ring-2 [&>button]:ring-orange-300 [&>button]:ring-offset-1",
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
            day_button: "w-9 h-9 mx-auto rounded-full text-sm hover:bg-gray-100 transition-colors flex items-center justify-center cursor-pointer",
            selected: "[&>button]:!bg-black [&>button]:!text-white [&>button]:!hover:bg-gray-800",
            disabled: "opacity-30 cursor-not-allowed [&>button]:cursor-not-allowed",
            today: "[&>button]:font-bold",
            outside: "opacity-40",
          }}
        />
      </div>

      {/* Auto-save indicator */}
      {isPending && <p className="text-xs text-center text-gray-400">Saving…</p>}

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
