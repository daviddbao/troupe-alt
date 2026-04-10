"use client"

import dynamic from "next/dynamic"

const AggregateCalendar = dynamic(
  () => import("./aggregate-calendar").then((m) => m.AggregateCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="border border-gray-200 rounded-xl p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mx-auto" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded-full" />
          ))}
        </div>
      </div>
    ),
  }
)

type Props = {
  dateCounts: Record<string, number>
  memberCount: number
}

export function AggregateCalendarClient(props: Props) {
  return <AggregateCalendar {...props} />
}
