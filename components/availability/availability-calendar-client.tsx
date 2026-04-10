"use client"

import dynamic from "next/dynamic"

const AvailabilityCalendar = dynamic(
  () => import("./availability-calendar").then((m) => m.AvailabilityCalendar),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-xl" /> }
)

export function AvailabilityCalendarClient({
  tripId,
  savedDates,
}: {
  tripId: string
  savedDates: string[]
}) {
  return <AvailabilityCalendar tripId={tripId} savedDates={savedDates} />
}
