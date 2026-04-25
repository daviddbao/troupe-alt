"use client"

import dynamic from "next/dynamic"

const AvailabilityCalendar = dynamic(
  () => import("./availability-calendar").then((m) => m.AvailabilityCalendar),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-xl" /> }
)

export function AvailabilityCalendarClient({
  tripId,
  savedDates,
  inline,
  dateCounts,
  memberCount,
  scheduledStart,
  scheduledEnd,
}: {
  tripId: string
  savedDates: string[]
  inline?: boolean
  dateCounts?: Record<string, number>
  memberCount?: number
  scheduledStart?: string | null
  scheduledEnd?: string | null
}) {
  return (
    <AvailabilityCalendar
      tripId={tripId}
      savedDates={savedDates}
      onSaved={inline ? () => {} : undefined}
      dateCounts={dateCounts}
      memberCount={memberCount}
      scheduledStart={scheduledStart}
      scheduledEnd={scheduledEnd}
    />
  )
}
