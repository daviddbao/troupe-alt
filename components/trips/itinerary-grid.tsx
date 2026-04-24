"use client"

import React, { useState, useTransition, useEffect, useRef } from "react"
import {
  addTripActivity,
  deleteTripActivity,
  toggleActivityAttendance,
  updateActivityCategory,
} from "@/lib/actions/trips"
import { DEFAULT_CATEGORIES, suggestCategory, getCategoryColor } from "@/lib/activity-categories"

// ── Time config ───────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 40        // px per 30-min slot
const START_MIN  = 7 * 60    // 7:00 AM = 420
const END_MIN    = 22 * 60   // 10:00 PM = 1320
const SLOT_MINS  = 30

const SLOTS = Array.from(
  { length: (END_MIN - START_MIN) / SLOT_MINS },
  (_, i) => START_MIN + i * SLOT_MINS
)

const TIME_OPTIONS = SLOTS.map((mins) => ({ mins, label: formatMins(mins) }))

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? "pm" : "am"
  const hour   = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0
    ? `${hour}${period}`
    : `${hour}:${m.toString().padStart(2, "0")}${period}`
}

function minsRange(start: number, end: number) {
  return `${formatMins(start)}–${formatMins(end)}`
}

function offsetToActualDate(scheduledStart: string, offset: number): string {
  const d = new Date(scheduledStart + "T00:00:00")
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Attendee = { userId: string; displayName: string }

// Flights pre-processed by the page: deduplicated, offset-relative
export type FlightBlock = {
  key: string
  flightNumber: string
  departureAirport: string | null
  arrivalAirport: string | null
  dayOffset: number
  startMins: number
  endMins: number
  members: string[]       // display names
  overnight: boolean      // arrives next day
}

// Hotels pre-processed by the page: offset-relative, spans multiple days
export type HotelBlock = {
  key: string
  name: string
  address: string | null
  startOffset: number    // check-in day offset
  endOffset: number      // check-out day offset (exclusive)
  members: string[]      // display names of people at this hotel
}

type Activity = {
  id: string
  dayOffset: number
  startMins: number
  endMins: number
  title: string
  isOpen: number | boolean
  isPrivate: number | boolean
  category: string | null
  color: string | null
  location: string | null
  createdBy: string
  attendees: Attendee[]
  iAmAttending: boolean
}

type Member = { userId: string; displayName: string; role: string }

function isOpen(a: Activity)    { return Boolean(a.isOpen) }
function isPrivate(a: Activity) { return Boolean(a.isPrivate) }

function cardColor(a: Activity): string {
  return a.color || getCategoryColor(a.category)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ItineraryGrid({
  tripId,
  dayCount,
  scheduledDays,
  scheduledStart,
  activities: initial,
  flightBlocks = [],
  hotelBlocks = [],
  myUserId,
  isOrganizer,
  members,
}: {
  tripId: string
  dayCount: number
  scheduledDays: number
  scheduledStart: string | null
  activities: Activity[]
  flightBlocks?: FlightBlock[]
  hotelBlocks?: HotelBlock[]
  myUserId: string
  isOrganizer: boolean
  members: Member[]
}) {
  const myDisplayName = members.find((m) => m.userId === myUserId)?.displayName ?? ""

  // Compute default day for day view: today's offset if within trip, else 0
  const defaultDay = (() => {
    if (!scheduledStart) return 0
    const today = new Date().toISOString().slice(0, 10)
    const ms = new Date(today + "T00:00:00").getTime() - new Date(scheduledStart + "T00:00:00").getTime()
    const offset = Math.round(ms / 86400000)
    return Math.max(0, Math.min(offset, dayCount - 1))
  })()

  const [viewMode, setViewMode]   = useState<"grid" | "day">("grid")
  const [currentDay, setCurrentDay] = useState(defaultDay)
  const [local, setLocal]   = useState<Activity[]>(initial)
  const [modal, setModal]   = useState<{ dayOffset: number; slotMins: number } | null>(null)
  const [toast, setToast]   = useState<string | null>(null)
  const [isPending, startT] = useTransition()
  const toastRef            = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Add-modal fields
  const [title,     setTitle]     = useState("")
  const [startMins, setStartMins] = useState(540)
  const [endMins,   setEndMins]   = useState(600)
  const [open,      setOpen]      = useState(true)
  const [priv,      setPriv]      = useState(false)
  const [location,  setLocation]  = useState("")
  const [selCat,    setSelCat]    = useState<string | null>(null)
  const [selColor,  setSelColor]  = useState<string | null>(null)
  const [sugCat,    setSugCat]    = useState<string | null>(null)

  // Auto-suggest category from title as user types
  useEffect(() => {
    const cat = suggestCategory(title)
    setSugCat(cat?.name ?? null)
    if (cat && !selCat) {
      setSelCat(cat.name)
      setSelColor(cat.color)
    }
    if (!cat && sugCat && selCat === sugCat) {
      // clear suggestion that no longer matches
      setSelCat(null)
      setSelColor(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  function showToast(msg: string) {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2500)
  }

  function openModal(dayOffset: number, slotMins: number) {
    setModal({ dayOffset, slotMins })
    setTitle("")
    setStartMins(slotMins)
    setEndMins(Math.min(slotMins + 60, END_MIN))
    setOpen(true)
    setPriv(false)
    setLocation("")
    setSelCat(null)
    setSelColor(null)
    setSugCat(null)
  }

  function handleAdd() {
    if (!modal || !title.trim()) return
    const color = selColor || getCategoryColor(selCat)

    startT(async () => {
      const result = await addTripActivity(tripId, {
        dayOffset: modal.dayOffset,
        startMins,
        endMins,
        title:     title.trim(),
        isOpen:    open,
        isPrivate: priv,
        category:  selCat,
        color,
        location:  location.trim() || null,
      })
      if (result?.error) {
        showToast(result.error)
      } else {
        setLocal((prev) => [
          ...prev,
          {
            id:          result?.id ?? crypto.randomUUID(),
            dayOffset:   modal.dayOffset,
            startMins,
            endMins,
            title:       title.trim(),
            isOpen:      open ? 1 : 0,
            isPrivate:   priv ? 1 : 0,
            category:    selCat,
            color,
            location:    location.trim() || null,
            createdBy:   myUserId,
            attendees:   open ? [{ userId: myUserId, displayName: myDisplayName }] : [],
            iAmAttending: open,
          },
        ])
        setModal(null)
        showToast("Activity added")
      }
    })
  }

  function handleDelete(activityId: string) {
    startT(async () => {
      const result = await deleteTripActivity(tripId, activityId)
      if (result?.error) {
        showToast(result.error)
      } else {
        setLocal((prev) => prev.filter((a) => a.id !== activityId))
      }
    })
  }

  function handleToggleJoin(activityId: string) {
    // Optimistic update
    setLocal((prev) =>
      prev.map((a) => {
        if (a.id !== activityId) return a
        const joining = !a.iAmAttending
        return {
          ...a,
          iAmAttending: joining,
          attendees: joining
            ? [...a.attendees, { userId: myUserId, displayName: myDisplayName }]
            : a.attendees.filter((att) => att.userId !== myUserId),
        }
      })
    )
    startT(async () => {
      await toggleActivityAttendance(activityId, tripId)
    })
  }

  function handleUpdateCategory(activityId: string, category: string | null, color: string | null) {
    setLocal((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, category, color } : a))
    )
    startT(async () => {
      await updateActivityCategory(activityId, tripId, category, color)
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Toolbar: view toggle + legend */}
      <div className="flex items-center gap-3 mb-4">
        {/* Grid / Day toggle */}
        <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg">
          {(["grid", "day"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {mode === "grid" ? "Full trip" : "Day view"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1">
          {DEFAULT_CATEGORIES.map((cat) => (
            <span key={cat.name} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </span>
          ))}
        </div>
      </div>

      {/* Day view */}
      {viewMode === "day" && (
        <div className="space-y-4">
          {/* Day nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentDay((d) => Math.max(0, d - 1))}
              disabled={currentDay === 0}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              aria-label="Previous day"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">Day {currentDay + 1}</p>
              {scheduledStart && (
                <p className="text-xs text-gray-400 mt-0.5">{offsetToActualDate(scheduledStart, currentDay)}</p>
              )}
            </div>
            <button
              onClick={() => setCurrentDay((d) => Math.min(dayCount - 1, d + 1))}
              disabled={currentDay === dayCount - 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              aria-label="Next day"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>

          {/* Hotels today */}
          {hotelBlocks.filter((h) => h.startOffset <= currentDay && currentDay < h.endOffset).map((h) => (
            <div key={h.key} className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 flex-shrink-0">
                <rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/><line x1="12" y1="12" x2="12" y2="12.01"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900">{h.name}</p>
                {h.address && <p className="text-xs text-amber-700 mt-0.5 truncate">{h.address}</p>}
              </div>
              {h.members.length > 1 && (
                <span className="text-xs text-amber-600">{h.members.length} people</span>
              )}
            </div>
          ))}

          {/* Flights today */}
          {flightBlocks.filter((f) => f.dayOffset === currentDay).map((fb) => (
            <div key={fb.key} className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 flex-shrink-0">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2c-.5.1-.7.7-.4 1l2.9 2.9L2.9 12c-.3.3-.1.9.4 1l3.8 1.1 1.1 3.8c.1.5.6.7 1 .4l1.8-1.3 2.9 2.9c.3.3.9.1 1-.4z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">
                  {fb.flightNumber}
                  {fb.departureAirport && fb.arrivalAirport && (
                    <span className="font-normal text-blue-700 ml-1.5">{fb.departureAirport} → {fb.arrivalAirport}</span>
                  )}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">{formatMins(fb.startMins)}{fb.overnight ? " (overnight)" : ` → ${formatMins(fb.endMins)}`}</p>
              </div>
              {fb.members.length > 0 && (
                <span className="text-xs text-blue-600">{fb.members.join(", ")}</span>
              )}
            </div>
          ))}

          {/* Activities for this day */}
          {(() => {
            const dayActs = local
              .filter((a) => a.dayOffset === currentDay)
              .sort((a, b) => a.startMins - b.startMins)

            return dayActs.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => openModal(currentDay, 540)}
              >
                <p className="text-sm text-gray-400">No activities yet</p>
                <p className="text-xs text-gray-300">Tap to add one</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayActs.map((act) => (
                  <DayActivityCard
                    key={act.id}
                    act={act}
                    myUserId={myUserId}
                    isOrganizer={isOrganizer}
                    isPending={isPending}
                    onDelete={handleDelete}
                    onToggleJoin={handleToggleJoin}
                  />
                ))}
              </div>
            )
          })()}

          {/* Add button */}
          <button
            onClick={() => openModal(currentDay, 540)}
            className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            + Add activity
          </button>
        </div>
      )}

      {/* Scrollable grid */}
      {viewMode === "grid" && (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `52px repeat(${dayCount}, minmax(150px, 1fr))`,
            minWidth: `${52 + dayCount * 150}px`,
          }}
        >
          {/* Header row */}
          <div className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 p-2" />
          {Array.from({ length: dayCount }, (_, i) => i).map((offset) => {
            const beyondTrip = scheduledDays > 0 && offset >= scheduledDays
            const actualDate = scheduledStart ? offsetToActualDate(scheduledStart, offset) : null
            return (
              <div
                key={offset}
                className={`border-b border-r border-gray-200 p-2 text-center last:border-r-0 ${beyondTrip ? "bg-gray-100/60" : "bg-gray-50"}`}
              >
                <p className={`text-xs font-semibold ${beyondTrip ? "text-gray-400" : "text-gray-700"}`}>
                  Day {offset + 1}
                </p>
                {actualDate
                  ? <p className={`text-xs mt-0.5 ${beyondTrip ? "text-gray-300" : "text-gray-400"}`}>{actualDate}</p>
                  : <p className="text-xs text-gray-300 mt-0.5">unscheduled</p>
                }
                {beyondTrip && (
                  <p className="text-xs text-gray-300 mt-0.5 italic">past end</p>
                )}
              </div>
            )
          })}

          {/* Hotel bar row — only shown when hotels exist */}
          {hotelBlocks.length > 0 && (
            <>
              <div className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-2 py-1.5 flex items-center">
                <span className="text-xs text-gray-400">Hotel</span>
              </div>
              {Array.from({ length: dayCount }, (_, i) => i).map((offset) => {
                const hotels = hotelBlocks.filter((h) => h.startOffset <= offset && offset < h.endOffset)
                return (
                  <div key={offset} className="border-b border-r border-gray-200 last:border-r-0 p-1 space-y-0.5 bg-white">
                    {hotels.map((h) => (
                      <div
                        key={h.key}
                        className="bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-xs text-amber-800 truncate"
                        title={`${h.name}${h.members.length > 1 ? ` · ${h.members.join(", ")}` : ""}`}
                      >
                        {offset === h.startOffset ? `▶ ${h.name}` : offset === h.endOffset - 1 ? `${h.name} ◀` : h.name}
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}

          {/* Time slots */}
          {SLOTS.map((slotMins) => (
            <React.Fragment key={slotMins}>
              {/* Time label — only on the hour */}
              <div
                className="sticky left-0 z-10 bg-white border-r border-b border-gray-100 px-2 flex items-start pt-1"
                style={{ height: SLOT_HEIGHT }}
              >
                {slotMins % 60 === 0 && (
                  <span className="text-xs text-gray-400 leading-none tabular-nums">
                    {formatMins(slotMins)}
                  </span>
                )}
              </div>

              {/* Day cells */}
              {Array.from({ length: dayCount }, (_, i) => i).map((offset) => {
                const cellActs = local.filter(
                  (a) => a.dayOffset === offset && a.startMins === slotMins
                )
                const cellFlights = flightBlocks.filter(
                  (f) => f.dayOffset === offset && f.startMins === slotMins
                )
                const beyondTrip = scheduledDays > 0 && offset >= scheduledDays
                return (
                  <div
                    key={`${offset}-${slotMins}`}
                    className={`border-r border-b border-gray-100 last:border-r-0 relative group cursor-pointer transition-colors ${beyondTrip ? "bg-gray-50/80 hover:bg-gray-100/60" : "hover:bg-gray-50/60"}`}
                    style={{ height: SLOT_HEIGHT }}
                    onClick={() => openModal(offset, slotMins)}
                  >
                    {cellFlights.map((fb) => (
                      <FlightCard key={fb.key} block={fb} slotHeight={SLOT_HEIGHT} slotMins={SLOT_MINS} />
                    ))}
                    {cellActs.map((act) => (
                      <ActivityCard
                        key={act.id}
                        act={act}
                        myUserId={myUserId}
                        isOrganizer={isOrganizer}
                        slotHeight={SLOT_HEIGHT}
                        slotMins={SLOT_MINS}
                        isPending={isPending}
                        onDelete={handleDelete}
                        onToggleJoin={handleToggleJoin}
                        onUpdateCategory={handleUpdateCategory}
                      />
                    ))}
                    {cellActs.length === 0 && cellFlights.length === 0 && (
                      <span className="text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center select-none pointer-events-none">
                        +
                      </span>
                    )}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      )}

      {/* Add activity modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl max-h-[92dvh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <h2 className="font-semibold">Add activity</h2>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  What&apos;s happening?
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Morning surf lesson"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                />
              </div>

              {/* Category chips */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Category
                  {sugCat && selCat === sugCat && (
                    <span className="ml-1.5 font-normal text-gray-400">auto-suggested</span>
                  )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_CATEGORIES.map((cat) => {
                    const active = selCat === cat.name
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setSelCat(null)
                            setSelColor(null)
                          } else {
                            setSelCat(cat.name)
                            setSelColor(cat.color)
                          }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                        style={
                          active
                            ? { backgroundColor: cat.color, borderColor: cat.color, color: "#fff" }
                            : { borderColor: "#e5e7eb", color: "#4b5563" }
                        }
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Start</label>
                  <select
                    value={startMins}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setStartMins(v)
                      if (endMins <= v) setEndMins(v + SLOT_MINS)
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    {TIME_OPTIONS.map(({ mins, label }) => (
                      <option key={mins} value={mins}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">End</label>
                  <select
                    value={endMins}
                    onChange={(e) => setEndMins(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    {TIME_OPTIONS
                      .filter(({ mins }) => mins > startMins)
                      .map(({ mins, label }) => (
                        <option key={mins} value={mins}>{label}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Location <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Playa Los Muertos"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                <Toggle
                  label="Open to others joining"
                  description="Members can RSVP to join"
                  value={open}
                  onChange={(v) => {
                    setOpen(v)
                    if (v) setPriv(false)
                  }}
                />
                {!open && (
                  <Toggle
                    label="Private"
                    description="Only visible to you"
                    value={priv}
                    onChange={setPriv}
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isPending || !title.trim()}
                  className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {isPending ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 ${value ? "bg-black" : "bg-gray-200"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  )
}

function ActivityCard({
  act,
  myUserId,
  isOrganizer,
  slotHeight,
  slotMins,
  isPending,
  onDelete,
  onToggleJoin,
  onUpdateCategory,
}: {
  act: Activity
  myUserId: string
  isOrganizer: boolean
  slotHeight: number
  slotMins: number
  isPending: boolean
  onDelete: (id: string) => void
  onToggleJoin: (id: string) => void
  onUpdateCategory: (id: string, cat: string | null, color: string | null) => void
}) {
  const [showCatPicker, setShowCatPicker] = useState(false)

  const span      = Math.max(1, (act.endMins - act.startMins) / slotMins)
  const color     = cardColor(act)
  const canDelete = act.createdBy === myUserId || isOrganizer
  const canEdit   = isOpen(act) || act.createdBy === myUserId
  const private_  = isPrivate(act)
  const open_     = isOpen(act)

  const cardHeight = span * slotHeight - 4

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute left-1 right-1 top-0.5 rounded-md border-l-[3px] shadow-sm overflow-hidden transition-opacity ${private_ ? "opacity-60" : ""}`}
      style={{
        height: cardHeight,
        borderLeftColor: color,
        backgroundColor: `${color}1A`,
        zIndex: 5,
      }}
    >
      <div className="px-1.5 py-1 h-full flex flex-col">
        {/* Title row */}
        <div className="flex items-start gap-0.5 min-w-0">
          {/* Category dot — tappable to change */}
          {canEdit && (
            <button
              onClick={() => setShowCatPicker((p) => !p)}
              className="flex-shrink-0 mt-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-white/50 hover:scale-125 transition-transform"
              style={{ backgroundColor: color }}
              title="Change category"
            />
          )}
          <p className="flex-1 text-xs font-semibold text-gray-800 leading-tight truncate ml-1 min-w-0">
            {private_ && <span className="mr-0.5 opacity-60">🔒</span>}
            {act.title}
          </p>
          {canDelete && (
            <button
              onClick={() => onDelete(act.id)}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-black/10 transition-opacity ml-0.5"
              aria-label="Delete activity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Time range */}
        {span >= 1 && (
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5 tabular-nums">
            {minsRange(act.startMins, act.endMins)}
          </p>
        )}

        {/* Location */}
        {act.location && span >= 2 && (
          <p className="text-[10px] text-gray-400 leading-tight truncate mt-0.5">
            📍 {act.location}
          </p>
        )}

        {/* Join / attendees */}
        {open_ && span >= 2 && (
          <div className="flex items-center justify-between mt-auto pt-0.5">
            <span className="text-[10px] text-gray-400">
              {act.attendees.length > 0
                ? `${act.attendees.length} joining`
                : "No one yet"}
            </span>
            <button
              onClick={() => onToggleJoin(act.id)}
              disabled={isPending}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors disabled:opacity-50 ${
                act.iAmAttending
                  ? "bg-green-100 text-green-700"
                  : "bg-white/70 text-gray-600 hover:bg-white"
              }`}
            >
              {act.iAmAttending ? "✓ In" : "+ Join"}
            </button>
          </div>
        )}
      </div>

      {/* Category picker popover */}
      {showCatPicker && (
        <div
          className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-gray-100 p-2 flex flex-wrap gap-1.5 w-48"
          onClick={(e) => e.stopPropagation()}
        >
          {DEFAULT_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => {
                onUpdateCategory(act.id, cat.name, cat.color)
                setShowCatPicker(false)
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all hover:border-gray-400"
              style={
                act.category === cat.name
                  ? { backgroundColor: cat.color, borderColor: cat.color, color: "#fff" }
                  : { borderColor: "#e5e7eb", color: "#374151" }
              }
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
          <button
            onClick={() => {
              onUpdateCategory(act.id, null, null)
              setShowCatPicker(false)
            }}
            className="px-2 py-1 rounded-full text-xs border border-dashed border-gray-200 text-gray-400 hover:border-gray-400"
          >
            None
          </button>
        </div>
      )}
    </div>
  )
}

function FlightCard({
  block,
  slotHeight,
  slotMins,
}: {
  block: FlightBlock
  slotHeight: number
  slotMins: number
}) {
  const durationMins = block.overnight
    ? (22 * 60 - block.startMins)
    : block.endMins - block.startMins
  const heightPx = Math.max(slotHeight, (durationMins / slotMins) * slotHeight)
  const route = [block.departureAirport, block.arrivalAirport].filter(Boolean).join(" → ")

  return (
    <div
      className="absolute inset-x-0.5 top-0.5 rounded overflow-hidden z-10 pointer-events-none"
      style={{ height: heightPx - 4, backgroundColor: "#dbeafe", borderLeft: "3px solid #3b82f6" }}
    >
      <div className="px-1.5 py-1 leading-tight">
        <div className="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2c-.5.1-.7.7-.4 1l2.9 2.9L2.9 12c-.3.3-.1.9.4 1l3.8 1.1 1.1 3.8c.1.5.6.7 1 .4l1.8-1.3 2.9 2.9c.3.3.9.1 1-.4z"/>
          </svg>
          <span className="text-xs font-semibold text-blue-700 truncate">{block.flightNumber}</span>
          {route && <span className="text-xs text-blue-500 truncate">{route}</span>}
        </div>
        {block.members.length > 0 && (
          <p className="text-xs text-blue-500 truncate mt-0.5">{block.members.join(", ")}</p>
        )}
        {block.overnight && <p className="text-xs text-blue-400 mt-0.5">overnight ›</p>}
      </div>
    </div>
  )
}

// ── Day view activity card ────────────────────────────────────────────────────

function DayActivityCard({
  act,
  myUserId,
  isOrganizer,
  isPending,
  onDelete,
  onToggleJoin,
}: {
  act: Activity
  myUserId: string
  isOrganizer: boolean
  isPending: boolean
  onDelete: (id: string) => void
  onToggleJoin: (id: string) => void
}) {
  const color     = cardColor(act)
  const canDelete = act.createdBy === myUserId || isOrganizer
  const open_     = isOpen(act)
  const private_  = isPrivate(act)

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white shadow-sm ${private_ ? "opacity-70" : ""}`}
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {private_ && <span className="text-xs opacity-60">🔒</span>}
          <span className="text-sm font-semibold text-gray-800">{act.title}</span>
          {act.category && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}25`, color }}>
              {act.category}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{minsRange(act.startMins, act.endMins)}</p>
        {act.location && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {act.location}</p>
        )}
        {open_ && (
          <p className="text-xs text-gray-400 mt-1">
            {act.attendees.length > 0 ? act.attendees.map((a) => a.displayName).join(", ") : "No one yet"}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {open_ && (
          <button
            onClick={() => onToggleJoin(act.id)}
            disabled={isPending}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              act.iAmAttending
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {act.iAmAttending ? "✓ In" : "+ Join"}
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(act.id)}
            disabled={isPending}
            className="text-gray-300 hover:text-red-500 transition-colors"
            aria-label="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
