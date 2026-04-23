import { getTripWithMembers, getTripActivities, getMemberFlights, getHotelStays } from "@/lib/actions/trips"
import { auth } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ItineraryGrid, type FlightBlock, type HotelBlock } from "@/components/trips/itinerary-grid"

type Props = { params: Promise<{ id: string }> }

function scheduledDayCount(start: string, end: string): number {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

function isoDateOf(datetime: string) {
  return datetime.slice(0, 10)
}

function minsOf(datetime: string) {
  const parts = datetime.slice(11, 16).split(":")
  return Number(parts[0]) * 60 + Number(parts[1])
}

function daysBetween(a: string, b: string) {
  const da = new Date(a + "T00:00:00")
  const db = new Date(b + "T00:00:00")
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

function buildFlightBlocks(
  flights: Awaited<ReturnType<typeof getMemberFlights>>,
  scheduledStart: string
): FlightBlock[] {
  const groups = new Map<string, typeof flights>()
  for (const f of flights) {
    const key = `${f.flightNumber.toUpperCase()}|${isoDateOf(f.departureAt)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }

  const blocks: FlightBlock[] = []
  for (const [, group] of groups) {
    const f = group[0]
    const depDate = isoDateOf(f.departureAt)
    const arrDate = isoDateOf(f.arrivalAt)
    const dayOffset = daysBetween(scheduledStart, depDate)
    const startMins = minsOf(f.departureAt)
    const overnight = arrDate > depDate
    const endMins = overnight ? 22 * 60 : minsOf(f.arrivalAt)

    blocks.push({
      key: `${f.flightNumber}|${f.departureAt}`,
      flightNumber: f.flightNumber,
      departureAirport: f.departureAirport,
      arrivalAirport: f.arrivalAirport,
      dayOffset,
      startMins,
      endMins,
      overnight,
      members: group.map((g) => g.displayName),
    })
  }

  return blocks
}

function buildHotelBlocks(
  hotels: Awaited<ReturnType<typeof getHotelStays>>,
  scheduledStart: string
): HotelBlock[] {
  // Group by hotel name + check-in so shared hotels become one block
  const groups = new Map<string, typeof hotels>()
  for (const h of hotels) {
    const key = `${h.name.toLowerCase()}|${h.checkIn}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(h)
  }

  const blocks: HotelBlock[] = []
  for (const [, group] of groups) {
    const h = group[0]
    blocks.push({
      key: `${h.name}|${h.checkIn}`,
      name: h.name,
      address: h.address,
      startOffset: daysBetween(scheduledStart, h.checkIn),
      endOffset: daysBetween(scheduledStart, h.checkOut),
      members: group.map((g) => g.displayName),
    })
  }

  return blocks
}

export default async function ItineraryPage({ params }: Props) {
  const { id } = await params
  const [session, data, activities, flights, hotels] = await Promise.all([
    auth(),
    getTripWithMembers(id),
    getTripActivities(id),
    getMemberFlights(id),
    getHotelStays(id),
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

  const dayCount = Math.max(scheduledDays, maxActivityDay + 1, 5)

  const flightBlocks = trip.scheduledStart
    ? buildFlightBlocks(flights, trip.scheduledStart)
    : []

  const hotelBlocks = trip.scheduledStart
    ? buildHotelBlocks(hotels, trip.scheduledStart)
    : []

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
        flightBlocks={flightBlocks}
        hotelBlocks={hotelBlocks}
        myUserId={myUserId}
        isOrganizer={isOrganizer}
        members={members}
      />
    </div>
  )
}
