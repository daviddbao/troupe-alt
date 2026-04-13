import { getTripWithMembers, getTripActivities } from "@/lib/actions/trips"
import { auth } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ItineraryGrid } from "@/components/trips/itinerary-grid"

type Props = { params: Promise<{ id: string }> }

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const cur = new Date(start + "T00:00:00")
  const endDate = new Date(end + "T00:00:00")
  while (cur <= endDate) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return days
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

  if (!trip.scheduledStart || !trip.scheduledEnd) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold">Itinerary</h1>
        </div>
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl space-y-3">
          <p className="font-medium text-gray-900">No dates scheduled yet</p>
          <p className="text-sm text-gray-500">
            {isOrganizer
              ? "Schedule trip dates first — then you can plan the itinerary."
              : "The organizer needs to schedule trip dates before you can plan the itinerary."}
          </p>
          <Link
            href={`/trips/${id}`}
            className="inline-block mt-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to trip
          </Link>
        </div>
      </div>
    )
  }

  const days = getDaysBetween(trip.scheduledStart, trip.scheduledEnd)

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
          <p className="text-xs text-gray-400 mt-0.5">Itinerary</p>
        </div>
      </div>

      <ItineraryGrid
        tripId={id}
        days={days}
        activities={activities}
        myUserId={myUserId}
        isOrganizer={isOrganizer}
        members={members}
      />
    </div>
  )
}
