import { getTripWithMembers } from "@/lib/actions/trips"
import { auth } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { PreferencesForm } from "@/components/trips/preferences-form"

type Props = { params: Promise<{ id: string }> }

export default async function PreferencesPage({ params }: Props) {
  const { id } = await params
  const [session, data] = await Promise.all([auth(), getTripWithMembers(id)])
  if (!data) notFound()

  const { trip, members } = data
  const isOrganizer = members.find((m) => m.userId === session?.user?.id)?.role === "organizer"

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/trips/${id}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold">Trip preferences</h1>
      </div>

      {!isOrganizer && (
        <p className="text-sm text-gray-500 mb-5 px-1">
          Only the organizer can edit trip preferences.
        </p>
      )}

      <PreferencesForm tripId={id} saved={trip.preferences ?? {}} isOrganizer={isOrganizer} />
    </div>
  )
}
