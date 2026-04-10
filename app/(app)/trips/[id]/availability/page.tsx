import { getTripWithMembers, getUserAvailability } from "@/lib/actions/trips"
import { notFound } from "next/navigation"
import Link from "next/link"
import { AvailabilityCalendarClient } from "@/components/availability/availability-calendar-client"

type Props = { params: Promise<{ id: string }> }

export default async function AvailabilityPage({ params }: Props) {
  const { id } = await params
  const data = await getTripWithMembers(id)
  if (!data) notFound()

  const savedDates = await getUserAvailability(id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold">Your availability</h1>
      </div>
      <AvailabilityCalendarClient tripId={id} savedDates={savedDates} />
    </div>
  )
}
