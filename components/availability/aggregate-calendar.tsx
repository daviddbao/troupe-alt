"use client"

import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"

function fromIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

type Props = {
  dateCounts: Record<string, number>
  memberCount: number
}

export function AggregateCalendar({ dateCounts, memberCount }: Props) {
  const fullDates: Date[] = []
  const highDates: Date[] = []
  const mediumDates: Date[] = []
  const lowDates: Date[] = []
  const minimalDates: Date[] = []

  for (const [date, count] of Object.entries(dateCounts)) {
    const coverage = memberCount > 0 ? count / memberCount : 0
    const d = fromIso(date)
    if (coverage >= 1.0) fullDates.push(d)
    else if (coverage >= 0.75) highDates.push(d)
    else if (coverage >= 0.5) mediumDates.push(d)
    else if (coverage >= 0.25) lowDates.push(d)
    else minimalDates.push(d)
  }

  const allDates = Object.keys(dateCounts).sort()
  const defaultMonth = allDates.length > 0 ? fromIso(allDates[0]) : new Date()

  return (
    <div className="space-y-3">
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <DayPicker
          defaultMonth={defaultMonth}
          modifiers={{ full: fullDates, high: highDates, medium: mediumDates, low: lowDates, minimal: minimalDates }}
          modifiersClassNames={{
            full: "[&>button]:!bg-green-600 [&>button]:!text-white",
            high: "[&>button]:!bg-green-200 [&>button]:!text-green-900",
            medium: "[&>button]:!bg-yellow-200 [&>button]:!text-yellow-900",
            low: "[&>button]:!bg-orange-200 [&>button]:!text-orange-900",
            minimal: "[&>button]:!bg-gray-200 [&>button]:!text-gray-700",
          }}
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
            day_button: "w-9 h-9 mx-auto rounded-full text-sm flex items-center justify-center cursor-default select-none",
            today: "[&>button]:font-bold",
            outside: "opacity-40",
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block flex-shrink-0" />Everyone</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-200 inline-block flex-shrink-0" />Most</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-200 inline-block flex-shrink-0" />Half</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-200 inline-block flex-shrink-0" />Some</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block flex-shrink-0" />Few</span>
      </div>
    </div>
  )
}
