import { getUserTrips } from "@/lib/actions/trips"
import { CreateTripForm } from "@/components/trips/create-trip-form"
import Link from "next/link"

export default async function DashboardPage() {
  const trips = await getUserTrips()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Your trips</h1>
      </div>

      <CreateTripForm />

      {trips.length === 0 ? (
        <div className="mt-8 py-10 px-6 border border-dashed border-gray-200 rounded-xl space-y-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Plan your first trip</p>
            <p className="text-sm text-gray-500 mt-1">
              Troupe helps friend groups find dates that work for everyone — no more group chat chaos.
            </p>
          </div>
          <ol className="space-y-2 text-sm text-gray-500">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              Create a trip and invite your friends
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              Everyone marks their available dates on the calendar
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              See which dates work best for the whole group
            </li>
          </ol>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="flex items-center justify-between px-4 py-3.5 border border-gray-200 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all group"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{trip.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {trip.memberCount} {trip.memberCount === 1 ? "person" : "people"}
                    </span>
                    {trip.scheduledStart && trip.scheduledEnd && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-green-600 font-medium">Scheduled</span>
                      </>
                    )}
                  </div>
                </div>
                <svg
                  className="text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
