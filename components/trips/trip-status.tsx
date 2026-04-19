"use client"

import { useTransition } from "react"
import { updateTripStatus } from "@/lib/actions/trips"
import type { TripStatus } from "@/lib/db/schema"

const STATUS_CONFIG: Record<TripStatus, {
  label: string
  pill: string
  next?: TripStatus
  nextLabel?: string
}> = {
  planning:  { label: "Planning",   pill: "bg-blue-100 text-blue-700",   next: "booking", nextLabel: "Start booking" },
  booking:   { label: "Booking",    pill: "bg-amber-100 text-amber-700", next: "during",  nextLabel: "Trip started"  },
  during:    { label: "On Trip",    pill: "bg-green-100 text-green-700", next: "post",    nextLabel: "Mark complete" },
  post:      { label: "Completed",  pill: "bg-gray-100 text-gray-500"   },
}

export function TripStatus({
  tripId,
  status,
  isOrganizer,
  isScheduled,
}: {
  tripId: string
  status: TripStatus
  isOrganizer: boolean
  isScheduled: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const cfg = STATUS_CONFIG[status]

  function handleAdvance() {
    if (!cfg.next) return
    startTransition(async () => {
      await updateTripStatus(tripId, cfg.next!)
    })
  }

  const canAdvance = isOrganizer && !!cfg.next
  // Can't move to booking without scheduled dates
  const advanceBlocked = status === "planning" && !isScheduled

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${cfg.pill}`}>
        {cfg.label}
      </span>

      {canAdvance && (
        <button
          onClick={handleAdvance}
          disabled={isPending || advanceBlocked}
          title={advanceBlocked ? "Schedule trip dates before moving to booking" : undefined}
          className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Updating…" : `→ ${cfg.nextLabel}`}
        </button>
      )}
    </div>
  )
}
