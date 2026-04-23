import { getTripWithMembers, getTripActivities } from "@/lib/actions/trips"
import { auth } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ItineraryGrid } from "@/components/trips/itinerary-grid"

type Props = { params: Promise<{ id: string }> }

function scheduledDayCount(start: string, end: string): number {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

export default async function ItineraryPage({ params }: Props) {
  const { id } = await params
  const [session, data, activities] = await Promise.all([
    auth(),
    getTripWithMembers(id),
    getTripActivities(id),
  ])

  if (!data) notFound()

  const { trip, members } = data
  const myUserId = session?.user?.id ?? ""
  const isOrganizer = members.find((m) => m.userId === myUserId)?.role === "organizer"

  const scheduledDays =
    trip.scheduledStart && trip.scheduledEnd
      ? scheduledDayCount(trip.scheduledStart, trip.scheduledEnd)
      : 0

  const maxActivityDay =
    activities.length > 0 ? Math.max(...activities.map((a) => a.dayOffset)) : -1

  // Show at least 5 days; expand to fit scheduled trip or existing activities
  const dayCount = Math.max(scheduledDays, maxActivityDay + 1, 5)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{trip.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {scheduledDays > 0
              ? `${scheduledDays}-day itinerary`
              : "Draft itinerary — dates not scheduled yet"}
          </p>
        </div>
      </div>

      <ItineraryGrid
        tripId={id}
        dayCount={dayCount}
        scheduledDays={scheduledDays}
        scheduledStart={trip.scheduledStart ?? null}
        activities={activities}
        myUserId={myUserId}
        isOrganizer={isOrganizer}
        members={members}
      />
    </div>
  )
}
