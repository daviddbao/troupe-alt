"use client"

import { useState, useTransition } from "react"
import { addTripActivity, deleteTripActivity } from "@/lib/actions/trips"

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7am – 10pm

function formatHour(h: number) {
  if (h === 0) return "12am"
  if (h < 12) return `${h}am`
  if (h === 12) return "12pm"
  return `${h - 12}pm`
}

function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }
}

type Activity = {
  id: string
  date: string
  startHour: number
  endHour: number
  title: string
  type: "group" | "personal"
  createdBy: string
}

type Member = { userId: string; displayName: string; role: string }

export function ItineraryGrid({
  tripId,
  days,
  activities,
  myUserId,
  isOrganizer,
  members,
}: {
  tripId: string
  days: string[]
  activities: Activity[]
  myUserId: string
  isOrganizer: boolean
  members: Member[]
}) {
  const [modal, setModal] = useState<{ day: string; hour: number } | null>(null)
  const [title, setTitle] = useState("")
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(10)
  const [type, setType] = useState<"group" | "personal">("group")
  const [isPending, startTransition] = useTransition()
  const [localActivities, setLocalActivities] = useState<Activity[]>(activities)

  function openModal(day: string, hour: number) {
    setModal({ day, hour })
    setTitle("")
    setStartHour(hour)
    setEndHour(Math.min(hour + 1, 23))
    setType("group")
  }

  function handleAdd() {
    if (!modal || !title.trim()) return
    startTransition(async () => {
      const result = await addTripActivity(tripId, {
        date: modal.day,
        startHour,
        endHour,
        title: title.trim(),
        type,
      })
      if (!result?.error) {
        // Optimistic update
        setLocalActivities((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            date: modal.day,
            startHour,
            endHour,
            title: title.trim(),
            type,
            createdBy: myUserId,
          },
        ])
        setModal(null)
      }
    })
  }

  function handleDelete(activityId: string) {
    startTransition(async () => {
      await deleteTripActivity(tripId, activityId)
      setLocalActivities((prev) => prev.filter((a) => a.id !== activityId))
    })
  }

  const memberMap = Object.fromEntries(members.map((m) => [m.userId, m.displayName]))

  return (
    <>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-black inline-block" />Group activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-300 inline-block" />Personal
        </span>
        <span className="ml-auto text-gray-400">Tap an empty slot to add an activity</span>
      </div>

      {/* Scrollable grid wrapper */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `52px repeat(${days.length}, minmax(120px, 1fr))`,
            minWidth: `${52 + days.length * 120}px`,
          }}
        >
          {/* Header row */}
          <div className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 p-2" />
          {days.map((day) => {
            const { weekday, date } = formatDay(day)
            return (
              <div
                key={day}
                className="border-b border-r border-gray-200 p-2 text-center bg-gray-50 last:border-r-0"
              >
                <p className="text-xs font-semibold text-gray-700">{weekday}</p>
                <p className="text-xs text-gray-400">{date}</p>
              </div>
            )
          })}

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <>
              {/* Hour label */}
              <div
                key={`label-${hour}`}
                className="sticky left-0 z-10 bg-white border-r border-b border-gray-100 px-2 py-1 text-right"
              >
                <span className="text-xs text-gray-400">{formatHour(hour)}</span>
              </div>

              {/* Day cells */}
              {days.map((day) => {
                const cellActivities = localActivities.filter(
                  (a) => a.date === day && a.startHour === hour
                )
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="border-r border-b border-gray-100 last:border-r-0 relative min-h-[44px] p-1 group cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => openModal(day, hour)}
                  >
                    {cellActivities.map((act) => {
                      const spanRows = act.endHour - act.startHour
                      const canDelete = act.createdBy === myUserId || isOrganizer
                      return (
                        <div
                          key={act.id}
                          onClick={(e) => e.stopPropagation()}
                          className={`rounded px-1.5 py-1 mb-1 relative ${
                            act.type === "group"
                              ? "bg-black text-white"
                              : "bg-gray-200 text-gray-800"
                          }`}
                          style={{ minHeight: `${spanRows * 44 - 4}px` }}
                        >
                          <p className="text-xs font-medium leading-tight truncate">{act.title}</p>
                          {spanRows > 1 && (
                            <p className="text-xs opacity-60 mt-0.5">
                              {formatHour(act.startHour)}–{formatHour(act.endHour)}
                            </p>
                          )}
                          {act.type === "personal" && (
                            <p className="text-xs opacity-50 truncate">{memberMap[act.createdBy] ?? "Someone"}</p>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(act.id)}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-white/20"
                              aria-label="Delete"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {/* Add hint on hover */}
                    {cellActivities.length === 0 && (
                      <span className="text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center select-none">
                        +
                      </span>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Add activity modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl">
            <h2 className="font-semibold mb-4">Add activity</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lunch at the market"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Start</label>
                  <select
                    value={startHour}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setStartHour(v)
                      if (endHour <= v) setEndHour(v + 1)
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">End</label>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    {HOURS.filter((h) => h > startHour).map((h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                    <option value={23}>{formatHour(23)}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Who?</label>
                <div className="flex gap-2">
                  {(["group", "personal"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        type === t ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {t === "group" ? "Group" : "Just me"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
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
      )}
    </>
  )
}
