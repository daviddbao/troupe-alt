"use client"

import { useState, useTransition, useRef, useMemo } from "react"
import { DayPicker } from "react-day-picker"
import { setAvailabilityDates } from "@/lib/actions/trips"
import "react-day-picker/style.css"

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fromIso(s: string): Date {
  const [y, m, day] = s.split("-").map(Number)
  return new Date(y, m - 1, day)
}

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

// Offsets from holiday base covering: holiday + nearest weekend + bridge days.
// Adds Friday before when holiday falls on a weekend (common US practice).
function getHolidayOffsets(base: Date): number[] {
  const dow = base.getDay() // 0=Sun … 6=Sat
  const prevSatOffset = -((dow + 1) % 7)
  const nextSatOffset = prevSatOffset === 0 ? 7 : prevSatOffset + 7
  const satOffset = Math.abs(prevSatOffset) <= nextSatOffset ? prevSatOffset : nextSatOffset
  const sunOffset = satOffset + 1
  const friOffset = dow === 6 ? -1 : dow === 0 ? -2 : null
  const minOff = friOffset !== null ? Math.min(0, friOffset, satOffset) : Math.min(0, satOffset)
  const maxOff = Math.max(0, sunOffset)
  return Array.from({ length: maxOff - minOff + 1 }, (_, i) => minOff + i)
}

function buildHolidays(): { label: string; dates: string[] }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoff = new Date(today)
  cutoff.setFullYear(cutoff.getFullYear() + 1)
  const y = today.getFullYear()
  const result: { label: string; dates: string[] }[] = []
  const seen = new Set<string>()

  for (const year of [y, y + 1]) {
    const defs = [
      { label: "New Year's",      base: new Date(year, 0, 1) },
      { label: "MLK Day",         base: nthWeekday(year, 0, 1, 3) },
      { label: "Presidents' Day", base: nthWeekday(year, 1, 1, 3) },
      { label: "Memorial Day",    base: lastWeekday(year, 4, 1) },
      { label: "Juneteenth",      base: new Date(year, 5, 19) },
      { label: "4th of July",     base: new Date(year, 6, 4) },
      { label: "Labor Day",       base: nthWeekday(year, 8, 1, 1) },
      { label: "Columbus Day",    base: nthWeekday(year, 9, 1, 2) },
      { label: "Veterans Day",    base: new Date(year, 10, 11) },
      { label: "Thanksgiving",    base: nthWeekday(year, 10, 4, 4) },
      { label: "Christmas",       base: new Date(year, 11, 25) },
    ]
    for (const { label, base } of defs) {
      if (seen.has(label)) continue
      const offsets = getHolidayOffsets(base)
      const dates = offsets
        .map((o) => { const d = new Date(base); d.setDate(d.getDate() + o); return d })
        .filter((d) => d >= today && d <= cutoff)
        .map(toIso)
      if (dates.length > 0) { result.push({ label, dates }); seen.add(label) }
    }
  }
  return result
}

const HOLIDAYS = buildHolidays()

function getDatesBetween(a: string, b: string): string[] {
  const [start, end] = a <= b ? [a, b] : [b, a]
  const dates: string[] = []
  const cur = fromIso(start)
  const endDate = fromIso(end)
  while (cur <= endDate) {
    dates.push(toIso(cur))
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
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

export function AvailabilityCalendar({ tripId, savedDates, onSaved, dateCounts, memberCount, scheduledStart, scheduledEnd }: Props) {
  const [selected, setSelected] = useState<string[]>(savedDates)
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [eraseMode, setEraseMode] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [flashDates, setFlashDates] = useState<string[]>([])
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d
  })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPointerTypeRef = useRef<string>("mouse")

  // Drag state — refs only (no re-renders during drag)
  const isDraggingRef = useRef(false)
  const dragAnchorRef = useRef<string | null>(null)
  const hasDragMovedRef = useRef(false)
  const dragCommittedRef = useRef(false)

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
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

  function handleDayClick(day: Date) {
    if (dragCommittedRef.current) { dragCommittedRef.current = false; return }
    const iso = toIso(day)
    if (day < today) return

    if (eraseMode) {
      if (rangeAnchor === null) {
        setRangeAnchor(iso)
      } else if (rangeAnchor === iso) {
        const next = selected.filter((d) => d !== iso)
        setSelected(next); setRangeAnchor(null); setHoverDate(null); scheduleAutoSave(next)
      } else {
        const next = selected.filter((d) => !getDatesBetween(rangeAnchor, iso).includes(d))
        setSelected(next); setRangeAnchor(null); setHoverDate(null); scheduleAutoSave(next)
      }
      return
    }

    if (rangeAnchor === null) {
      if (selected.includes(iso)) {
        // Tap on already-selected date: deselect immediately
        const next = selected.filter((d) => d !== iso)
        setSelected(next); scheduleAutoSave(next)
      } else {
        // First date of a range — set anchor (shown in blue, not yet added to selected)
        setRangeAnchor(iso); setHoverDate(null)
      }
    } else if (rangeAnchor === iso) {
      // Tap anchor again: cancel
      setRangeAnchor(null); setHoverDate(null)
    } else {
      // Complete the range
      const dates = getDatesBetween(rangeAnchor, iso).filter((d) => fromIso(d) >= today)
      const next = [...selected]
      for (const d of dates) if (!next.includes(d)) next.push(d)
      setSelected(next); setRangeAnchor(null); setHoverDate(null); scheduleAutoSave(next)
    }
  }

  function handleDayMouseEnter(day: Date) {
    // Skip synthetic mouseenter events fired after touch taps
    if (lastPointerTypeRef.current === "touch") return
    const iso = toIso(day)
    setHoverDate(iso)
    if (isDraggingRef.current && dragAnchorRef.current && !hasDragMovedRef.current && iso !== dragAnchorRef.current) {
      hasDragMovedRef.current = true
      setRangeAnchor(dragAnchorRef.current)
    }
  }

  function handleCalendarPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    lastPointerTypeRef.current = e.pointerType
    if (e.button !== 0) return
    if (e.pointerType === "touch") return
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
      setSelected(next); setRangeAnchor(null); setHoverDate(null)
      dragCommittedRef.current = true; scheduleAutoSave(next)
    }
    isDraggingRef.current = false; hasDragMovedRef.current = false; dragAnchorRef.current = null
  }

  // Preview: anchor styled separately; hoverDate is the other end
  const previewComputed = useMemo(() => {
    if (!rangeAnchor || !hoverDate || eraseMode) return { mid: [] as Date[], end: [] as Date[] }
    const all = getDatesBetween(rangeAnchor, hoverDate).filter((d) => fromIso(d) >= today)
    const end = !selected.includes(hoverDate) && hoverDate !== rangeAnchor ? [fromIso(hoverDate)] : []
    const mid = all
      .filter((d) => d !== rangeAnchor && d !== hoverDate && !selected.includes(d))
      .map(fromIso)
    return { mid, end }
  }, [rangeAnchor, hoverDate, eraseMode, today, selected])

  const erasePreviewDates = useMemo(() => {
    if (!eraseMode || !rangeAnchor || !hoverDate) return []
    return getDatesBetween(rangeAnchor, hoverDate).filter((d) => selected.includes(d)).map(fromIso)
  }, [eraseMode, rangeAnchor, hoverDate, selected])

  function toggleHoliday(dates: string[]) {
    const valid = dates.filter((d) => fromIso(d) >= today)
    const allSelected = valid.length > 0 && valid.every((d) => selected.includes(d))
    setRangeAnchor(null)
    let next: string[]
    if (allSelected) {
      next = selected.filter((d) => !valid.includes(d))
      setSelected(next); showToast(`Removed ${valid.length} date${valid.length !== 1 ? "s" : ""}`)
    } else {
      const newDates = valid.filter((d) => !selected.includes(d))
      next = [...selected]
      for (const d of valid) if (!next.includes(d)) next.push(d)
      setSelected(next); flash(newDates); showToast(`Added ${newDates.length} date${newDates.length !== 1 ? "s" : ""}`)
    }
    scheduleAutoSave(next)
    if (valid.length > 0) setCalendarMonth(fromIso(valid[0]))
  }

  function cancelRange() { setRangeAnchor(null); setHoverDate(null) }

  function handleClearAll() {
    setSelected([]); setRangeAnchor(null); setHoverDate(null); setShowClearConfirm(false)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    startTransition(async () => {
      await setAvailabilityDates(tripId, [])
      showToast("Cleared")
      if (onSaved) onSaved()
    })
  }

  function scheduleAutoSave(dates: string[]) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      startTransition(async () => {
        await setAvailabilityDates(tripId, dates)
        showToast("Saved")
        if (onSaved) onSaved()
      })
    }, 600)
  }

  // Aggregate availability overlay
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

  // Trip date indicator on calendar
  const tripDateObjs = useMemo(() => {
    if (!scheduledStart || !scheduledEnd) return []
    return getDatesBetween(scheduledStart, scheduledEnd).map(fromIso)
  }, [scheduledStart, scheduledEnd])

  const visibleHolidays = HOLIDAYS.filter((h) => h.dates.length > 0)
  const selectedDates = selected.map(fromIso)
  const anchorDates = rangeAnchor ? [fromIso(rangeAnchor)] : []
  const flashDateObjs = flashDates.map(fromIso)

  return (
    <div className="space-y-3">
      {/* Chips: Trip dates + holidays */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
          <button
            onClick={() => scheduledStart && setCalendarMonth(fromIso(scheduledStart))}
            disabled={!scheduledStart}
            className={`px-3 py-1.5 text-xs font-medium border rounded-full transition-all whitespace-nowrap ${
              scheduledStart
                ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-gray-200 text-gray-300 cursor-not-allowed"
            }`}
          >
            Trip dates
          </button>
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

      {rangeAnchor && (
        <p className="text-xs text-center text-gray-500">
          {eraseMode ? "Tap end date to erase range" : "Tap end date to fill range"}
        </p>
      )}

      {/* Calendar */}
      <div
        data-testid="availability-calendar"
        className={`border rounded-xl overflow-hidden transition-colors select-none ${rangeAnchor ? "border-blue-300" : "border-gray-200"}`}
        onPointerDown={handleCalendarPointerDown}
        onPointerUp={handleCalendarPointerUp}
        onPointerLeave={handleCalendarPointerUp}
      >
        <DayPicker
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onDayClick={handleDayClick}
          onDayMouseEnter={handleDayMouseEnter}
          onDayMouseLeave={() => { if (!isDraggingRef.current) setHoverDate(null) }}
          modifiers={{
            selected: selectedDates,
            anchor: anchorDates,
            previewMid: previewComputed.mid,
            previewEnd: previewComputed.end,
            erasePreview: erasePreviewDates,
            flash: flashDateObjs,
            tripDate: tripDateObjs,
            aggFull,
            aggHigh,
            aggMed,
            aggLow,
          }}
          modifiersClassNames={{
            selected: "[&>button]:bg-black [&>button]:text-white [&>button]:hover:bg-gray-800",
            anchor: "[&>button]:bg-blue-500 [&>button]:text-white [&>button]:ring-2 [&>button]:ring-blue-700 [&>button]:ring-offset-1",
            previewMid: "[&>button]:bg-blue-200 [&>button]:text-blue-900",
            previewEnd: "[&>button]:bg-blue-400 [&>button]:text-white [&>button]:ring-2 [&>button]:ring-blue-600 [&>button]:ring-offset-1",
            erasePreview: "[&>button]:bg-red-100 [&>button]:text-red-700",
            flash: "[&>button]:bg-amber-300 [&>button]:text-amber-900",
            tripDate: "[&>button]:ring-2 [&>button]:ring-green-500 [&>button]:ring-offset-1",
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
            disabled: "opacity-30 cursor-not-allowed [&>button]:cursor-not-allowed",
            today: "[&>button]:font-bold",
            outside: "opacity-40",
          }}
        />
      </div>

      {/* Ring legend — only shown when group data is present */}
      {dateCounts && memberCount && memberCount > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400">Rings = others&apos; availability:</span>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-green-500" /> All
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-green-300" /> Most
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-yellow-300" /> Half
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-orange-300" /> Some
            </span>
          </div>
        </div>
      )}

      {isPending && <p className="text-xs text-center text-gray-400">Saving…</p>}

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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-900 text-white text-sm rounded-full shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
