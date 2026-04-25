import { getTripWithMembers, getExistingInvite, getUserAvailability, getTripAggregateAvailability, getTripIdeas, getPackingList, getMemberFlights, getHotelStays } from "@/lib/actions/trips"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { InviteSection } from "@/components/trips/invite-section"
import { AggregateCalendarClient } from "@/components/availability/aggregate-calendar-client"
import { ScheduleTrip } from "@/components/trips/schedule-trip"
import { TripActions } from "@/components/trips/trip-actions"
import { TripStatus } from "@/components/trips/trip-status"
import { IdeasBoard } from "@/components/trips/ideas-board"
import { PackingList } from "@/components/trips/packing-list"
import { FlightsSection } from "@/components/trips/flights-section"
import { HotelsSection } from "@/components/trips/hotels-section"
import { TripTabs } from "@/components/trips/trip-tabs"
import { AvailabilityCalendar } from "@/components/availability/availability-calendar"
import type { TripStatus as TripStatusType } from "@/lib/db/schema"

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ joined?: string }> }

const AVATAR_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-green-100", text: "text-green-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
]

function getAvatarColor(userId: string) {
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function formatScheduledDates(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" }
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-US", opts)
  if (start === end) return s
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-US", { day: "numeric" })
  const eMonth = new Date(end + "T00:00:00").toLocaleDateString("en-US", { month: "long" })
  const sMonth = new Date(start + "T00:00:00").toLocaleDateString("en-US", { month: "long" })
  return sMonth === eMonth ? `${s}–${e}` : `${s} – ${eMonth} ${e}`
}

export default async function TripPage({ params, searchParams }: Props) {
  const [{ id }, { joined }] = await Promise.all([params, searchParams])
  const [session, data, myDates, existingInviteCode, aggregate, ideas, packingList, flights, hotels] = await Promise.all([
    auth(),
    getTripWithMembers(id),
    getUserAvailability(id),
    getExistingInvite(id),
    getTripAggregateAvailability(id),
    getTripIdeas(id),
    getPackingList(id),
    getMemberFlights(id),
    getHotelStays(id),
  ])

  if (!data) notFound()

  const { trip, members } = data
  const myUserId = session?.user?.id ?? ""
  const myRole = members.find((m) => m.userId === myUserId)?.role
  const isOrganizer = myRole === "organizer"
  const hasAvailability = myDates.length > 0
  const submittedUserIds = new Set(aggregate?.submittedUserIds ?? [])
  const submittedCount = members.filter((m) => submittedUserIds.has(m.userId)).length
  const bestWindows = aggregate?.bestWindows ?? []
  const minNights = aggregate?.minNights ?? 1
  const hdrs = await headers()
  const host = hdrs.get("host") ?? ""
  const proto = hdrs.get("x-forwarded-proto") ?? "https"
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL ?? "")
  const isScheduled = !!(trip.scheduledStart && trip.scheduledEnd)
  const tripStatus = (trip.status ?? "planning") as TripStatusType

  const logisticsCount = flights.length + hotels.length + packingList.length
  const ideasCount = ideas.length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">{trip.name}</h1>
          <TripStatus
            tripId={id}
            status={tripStatus}
            isOrganizer={isOrganizer}
            isScheduled={isScheduled}
          />
        </div>
        <TripActions tripId={id} tripName={trip.name} isOrganizer={isOrganizer} members={members} myUserId={myUserId} />
      </div>

      {/* Joined banner */}
      {joined === "1" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <svg className="text-blue-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <p className="text-sm font-medium text-blue-900">You&apos;ve joined <span className="font-semibold">{trip.name}</span>!</p>
        </div>
      )}

      {/* Scheduled dates banner */}
      {isScheduled && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
          <svg className="text-green-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="text-sm font-semibold text-green-900 flex-1">
            {formatScheduledDates(trip.scheduledStart!, trip.scheduledEnd!)}
          </p>
          <span className="text-xs text-green-700">Trip scheduled</span>
        </div>
      )}

      {isScheduled && (
        <Link
          href={`/trips/${id}/itinerary`}
          className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
            </svg>
            <span className="text-sm font-medium">Itinerary</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>
      )}

      {/* Tabs */}
      <TripTabs
        logisticsCount={logisticsCount}
        ideasCount={ideasCount}
        planContent={
          <div className="space-y-4">
            {/* Group availability */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Group availability</h2>
                <span className="text-xs text-gray-400">{submittedCount}/{members.length} submitted</span>
              </div>

              {bestWindows.length > 0 ? (
                <ul className="space-y-1.5">
                  {bestWindows.map((w, i) => {
                    const pct = Math.round(w.coverage * 100)
                    const dotColor =
                      pct >= 100 ? "bg-green-600" :
                      pct >= 75 ? "bg-green-300" :
                      pct >= 50 ? "bg-yellow-300" :
                      "bg-orange-300"
                    const allDates = w.dates
                    const label = (() => {
                      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
                      const first = new Date(allDates[0] + "T00:00:00").toLocaleDateString("en-US", opts)
                      if (allDates.length === 1) return first
                      const last = new Date(allDates[allDates.length - 1] + "T00:00:00").toLocaleDateString("en-US", { day: "numeric" })
                      return `${first}–${last}`
                    })()
                    return (
                      <li key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-xs text-gray-400">{allDates.length}d</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {Math.round(w.avg)}/{aggregate!.memberCount}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">
                  {members.length <= 1
                    ? "Invite friends to start coordinating — the more people add availability, the better!"
                    : "No availability submitted yet — be the first!"}
                </p>
              )}

              {aggregate && Object.keys(aggregate.dateCounts).length > 0 && (
                <AggregateCalendarClient
                  dateCounts={aggregate.dateCounts}
                  memberCount={aggregate.memberCount}
                />
              )}

              {isOrganizer && (
                <ScheduleTrip
                  tripId={id}
                  bestWindows={bestWindows}
                  currentStart={trip.scheduledStart ?? null}
                  currentEnd={trip.scheduledEnd ?? null}
                  minNights={minNights}
                />
              )}
            </div>

            {/* Preferences */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">Preferences</h2>
                  <span className="text-xs text-gray-400">(optional)</span>
                </div>
                {!isOrganizer && trip.preferences && (
                  <span className="text-xs text-gray-400">set by organizer</span>
                )}
              </div>
              {trip.preferences ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Preferences saved.</p>
                  {isOrganizer && (
                    <Link href={`/trips/${id}/preferences`} className="text-sm font-medium hover:underline underline-offset-2">
                      Edit
                    </Link>
                  )}
                </div>
              ) : isOrganizer ? (
                <Link
                  href={`/trips/${id}/preferences`}
                  className="block text-center py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Set trip preferences →
                </Link>
              ) : (
                <p className="text-sm text-gray-400">No preferences set yet.</p>
              )}
            </div>

            {/* My availability */}
            <AvailabilityCalendar
              tripId={id}
              savedDates={myDates}
              onSaved={() => {}}
            />

            {/* People */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">People</h2>
              <ul className="space-y-2.5">
                {members.map((m) => {
                  const color = getAvatarColor(m.userId)
                  const hasSubmitted = submittedUserIds.has(m.userId)
                  return (
                    <li key={m.userId} className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center text-xs font-semibold ${color.text} flex-shrink-0`}>
                        {m.displayName[0].toUpperCase()}
                      </div>
                      <span className="text-sm flex-1">{m.displayName}</span>
                      {m.userId === myUserId && (
                        <span className="text-xs text-gray-400">you</span>
                      )}
                      {m.role === "organizer" && (
                        <span className="text-xs text-gray-400">organizer</span>
                      )}
                      {hasSubmitted ? (
                        <svg className="text-green-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-dashed border-gray-300 flex-shrink-0" />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Invite */}
            <InviteSection tripId={id} existingCode={existingInviteCode} baseUrl={baseUrl} />
          </div>
        }
        logisticsContent={
          <div className="space-y-4">
            <FlightsSection
              tripId={id}
              initialFlights={flights}
              myUserId={myUserId}
              isOrganizer={isOrganizer}
            />
            <HotelsSection
              tripId={id}
              initialHotels={hotels}
              myUserId={myUserId}
              isOrganizer={isOrganizer}
            />
            <PackingList
              tripId={id}
              initialItems={packingList}
              myUserId={myUserId}
              isOrganizer={isOrganizer}
              members={members.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
            />
          </div>
        }
        ideasContent={
          <IdeasBoard
            tripId={id}
            initialIdeas={ideas.map((i) => ({ ...i, createdAt: i.createdAt ?? null }))}
            myUserId={myUserId}
            isOrganizer={isOrganizer}
          />
        }
      />
    </div>
  )
}
