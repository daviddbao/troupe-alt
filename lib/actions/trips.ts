"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { trips, tripMembers, tripInvites, profiles, availabilityBlocks, tripActivities, activityAttendees, tripIdeas, packingItems, packingChecks, memberFlights, hotelStays, ideaVotes, tripExpenses, memberPreferences } from "@/lib/db/schema"
import { eq, and, inArray, desc, sql } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import type { TripPreferences, TripStatus } from "@/lib/db/schema"

export async function createTrip(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const name = (formData.get("name") as string)?.trim()
  if (!name) return { error: "Trip name is required." }

  const [trip] = await db
    .insert(trips)
    .values({ name, createdBy: session.user.id })
    .returning()

  await db.insert(tripMembers).values({
    tripId: trip.id,
    userId: session.user.id,
    role: "organizer",
  })

  redirect(`/trips/${trip.id}`)
}

export async function getTripWithMembers(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return null

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId))
  if (!trip) return null

  const members = await db
    .select({
      userId: tripMembers.userId,
      role: tripMembers.role,
      displayName: profiles.displayName,
    })
    .from(tripMembers)
    .innerJoin(profiles, eq(tripMembers.userId, profiles.id))
    .where(eq(tripMembers.tripId, tripId))

  // Check current user is a member
  const isMember = members.some((m) => m.userId === session.user.id)
  if (!isMember) return null

  return { trip, members }
}

export async function getUserTrips() {
  const session = await auth()
  if (!session?.user?.id) return []

  const rows = await db
    .select({ trip: trips })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .where(eq(tripMembers.userId, session.user.id))
    .orderBy(desc(trips.createdAt))

  if (rows.length === 0) return []

  const tripIds = rows.map((r) => r.trip.id)

  const [allMembers, myAvailability] = await Promise.all([
    db.select({ tripId: tripMembers.tripId, userId: tripMembers.userId })
      .from(tripMembers)
      .where(inArray(tripMembers.tripId, tripIds)),
    db.select({ tripId: availabilityBlocks.tripId })
      .from(availabilityBlocks)
      .where(and(
        inArray(availabilityBlocks.tripId, tripIds),
        eq(availabilityBlocks.userId, session.user.id)
      )),
  ])

  const memberCounts: Record<string, number> = {}
  for (const m of allMembers) {
    memberCounts[m.tripId] = (memberCounts[m.tripId] ?? 0) + 1
  }
  const tripsWithMyAvail = new Set(myAvailability.map((a) => a.tripId))

  return rows.map((r) => ({
    ...r.trip,
    memberCount: memberCounts[r.trip.id] ?? 1,
    iHaveSubmitted: tripsWithMyAvail.has(r.trip.id),
  }))
}

export async function getExistingInvite(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return null

  const [invite] = await db
    .select()
    .from(tripInvites)
    .where(eq(tripInvites.tripId, tripId))

  return invite ? invite.code : null
}

export async function createInvite(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, tripId),
        eq(tripMembers.userId, session.user.id)
      )
    )

  if (!membership) return { error: "Not a member of this trip." }

  const [existing] = await db
    .select()
    .from(tripInvites)
    .where(eq(tripInvites.tripId, tripId))

  if (existing) return { code: existing.code }

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  await db.insert(tripInvites).values({ tripId, code })

  return { code }
}

export async function joinTripByCode(code: string) {
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/invite/${code}`)

  const [invite] = await db
    .select()
    .from(tripInvites)
    .where(eq(tripInvites.code, code))

  if (!invite) return { error: "Invalid invite link." }

  const [existing] = await db
    .select()
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, invite.tripId),
        eq(tripMembers.userId, session.user.id)
      )
    )

  if (!existing) {
    await db.insert(tripMembers).values({
      tripId: invite.tripId,
      userId: session.user.id,
      role: "member",
    })
  }

  const isNew = !existing
  redirect(`/trips/${invite.tripId}${isNew ? "?joined=1" : ""}`)
}

export async function savePreferences(
  tripId: string,
  prefs: TripPreferences
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, tripId),
        eq(tripMembers.userId, session.user.id)
      )
    )

  if (!membership) return { error: "Not a member of this trip." }
  if (membership.role !== "organizer") return { error: "Only the organizer can set preferences." }

  await db.update(trips).set({ preferences: prefs }).where(eq(trips.id, tripId))

  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/preferences`)
}

export async function getUserAvailability(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const rows = await db
    .select({ date: availabilityBlocks.date })
    .from(availabilityBlocks)
    .where(
      and(
        eq(availabilityBlocks.tripId, tripId),
        eq(availabilityBlocks.userId, session.user.id)
      )
    )

  return rows.map((r) => r.date)
}

function isoToDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function computeBestWindows(
  dateCounts: Record<string, number>,
  memberCount: number,
  minNights = 1,
  max = 5
): { dates: string[]; avg: number; coverage: number }[] {
  if (memberCount === 0) return []
  const sorted = Object.keys(dateCounts).sort()
  if (sorted.length === 0) return []

  const windows: { dates: string[]; avg: number }[] = []
  let current = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round(
      (isoToDate(sorted[i]).getTime() - isoToDate(sorted[i - 1]).getTime()) / 86400000
    )
    if (diffDays === 1) {
      current.push(sorted[i])
    } else {
      const avg = current.reduce((s, d) => s + dateCounts[d], 0) / current.length
      windows.push({ dates: [...current], avg })
      current = [sorted[i]]
    }
  }
  const avg = current.reduce((s, d) => s + dateCounts[d], 0) / current.length
  windows.push({ dates: [...current], avg })

  const candidates: { dates: string[]; avg: number }[] = []
  for (const w of windows) {
    if (w.dates.length >= minNights) {
      for (let start = 0; start <= w.dates.length - minNights; start++) {
        const slice = w.dates.slice(start, start + minNights)
        const sliceAvg = slice.reduce((s, d) => s + dateCounts[d], 0) / slice.length
        candidates.push({ dates: slice, avg: sliceAvg })
      }
      candidates.push(w)
    }
  }

  if (candidates.length === 0) return []

  const seen = new Map<string, { dates: string[]; avg: number }>()
  for (const c of candidates) {
    const key = `${c.dates[0]}|${c.dates[c.dates.length - 1]}`
    const existing = seen.get(key)
    if (!existing || c.avg > existing.avg) seen.set(key, c)
  }

  return [...seen.values()]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, max)
    .map((w) => ({ ...w, coverage: w.avg / memberCount }))
}

export async function getTripAggregateAvailability(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return null

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return null

  const [members, blocks, tripRowArr] = await Promise.all([
    db.select({ userId: tripMembers.userId }).from(tripMembers).where(eq(tripMembers.tripId, tripId)),
    db.select({ userId: availabilityBlocks.userId, date: availabilityBlocks.date }).from(availabilityBlocks).where(eq(availabilityBlocks.tripId, tripId)),
    db.select({ preferences: trips.preferences }).from(trips).where(eq(trips.id, tripId)),
  ])

  const tripRow = tripRowArr[0]
  const minNights = (tripRow?.preferences as { nights?: number } | null)?.nights ?? 1

  const dateCounts: Record<string, number> = {}
  const submittedSet = new Set<string>()

  for (const block of blocks) {
    dateCounts[block.date] = (dateCounts[block.date] ?? 0) + 1
    submittedSet.add(block.userId)
  }

  return {
    dateCounts,
    memberCount: members.length,
    submittedUserIds: Array.from(submittedSet),
    bestWindows: computeBestWindows(dateCounts, members.length, minNights),
    minNights,
  }
}

export async function setAvailabilityDates(tripId: string, dates: string[]) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, tripId),
        eq(tripMembers.userId, session.user.id)
      )
    )

  if (!membership) return { error: "Not a member of this trip." }

  await db
    .delete(availabilityBlocks)
    .where(
      and(
        eq(availabilityBlocks.tripId, tripId),
        eq(availabilityBlocks.userId, session.user.id)
      )
    )

  if (dates.length > 0) {
    await db.insert(availabilityBlocks).values(
      dates.map((date) => ({
        tripId,
        userId: session.user.id,
        date,
      }))
    )
  }

  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/availability`)
}

export async function scheduleTripDates(tripId: string, startDate: string, endDate: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

  if (membership?.role !== "organizer") return { error: "Only the organizer can schedule the trip." }
  if (startDate > endDate) return { error: "Start date must be before end date." }

  await db
    .update(trips)
    .set({ scheduledStart: startDate, scheduledEnd: endDate })
    .where(eq(trips.id, tripId))

  revalidatePath(`/trips/${tripId}`)
}

export async function updateTripStatus(tripId: string, status: TripStatus) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

  if (membership?.role !== "organizer") return { error: "Only the organizer can update trip status." }

  await db.update(trips).set({ status }).where(eq(trips.id, tripId))
  revalidatePath(`/trips/${tripId}`)
}

export async function clearTripSchedule(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

  if (membership?.role !== "organizer") return { error: "Only the organizer can change the schedule." }

  await db
    .update(trips)
    .set({ scheduledStart: null, scheduledEnd: null })
    .where(eq(trips.id, tripId))

  revalidatePath(`/trips/${tripId}`)
}

export async function renameTrip(tripId: string, name: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

  if (membership?.role !== "organizer") return { error: "Only the organizer can rename the trip." }

  const trimmed = name.trim()
  if (!trimmed) return { error: "Trip name is required." }

  await db.update(trips).set({ name: trimmed }).where(eq(trips.id, tripId))
  revalidatePath(`/trips/${tripId}`)
  revalidatePath("/dashboard")
}

export async function deleteTrip(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

  if (membership?.role !== "organizer") return { error: "Only the organizer can delete the trip." }

  await db.delete(trips).where(eq(trips.id, tripId))
  redirect("/dashboard")
}

export async function leaveTrip(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

  if (!membership) return { error: "Not a member of this trip." }

  if (membership.role === "organizer") {
    const otherOrganizers = await db
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.role, "organizer")))
    const hasOtherOrganizer = otherOrganizers.some((m) => m.userId !== session.user!.id)
    if (!hasOtherOrganizer) return { error: "promote_first" }
  }

  // Clean up all user data for this trip before removing membership
  const userId = session.user.id
  await Promise.all([
    // Activity attendances
    db.select({ id: tripActivities.id }).from(tripActivities).where(eq(tripActivities.tripId, tripId))
      .then((ids) => ids.length > 0
        ? db.delete(activityAttendees).where(and(eq(activityAttendees.userId, userId), inArray(activityAttendees.activityId, ids.map((a) => a.id))))
        : null
      ),
    // Availability
    db.delete(availabilityBlocks).where(and(eq(availabilityBlocks.tripId, tripId), eq(availabilityBlocks.userId, userId))),
    // Flights
    db.delete(memberFlights).where(and(eq(memberFlights.tripId, tripId), eq(memberFlights.userId, userId))),
    // Hotels
    db.delete(hotelStays).where(and(eq(hotelStays.tripId, tripId), eq(hotelStays.userId, userId))),
    // Packing checks (the items themselves stay, just uncheck)
    db.select({ id: packingItems.id }).from(packingItems).where(eq(packingItems.tripId, tripId))
      .then((ids) => ids.length > 0
        ? db.delete(packingChecks).where(and(eq(packingChecks.userId, userId), inArray(packingChecks.itemId, ids.map((i) => i.id))))
        : null
      ),
  ])

  await db
    .delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))

  redirect("/dashboard")
}

export async function promoteMember(tripId: string, userId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

  if (membership?.role !== "organizer") return { error: "Only an organizer can promote members." }

  const [target] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
  if (!target) return { error: "User is not a member of this trip." }

  await db
    .update(tripMembers)
    .set({ role: "organizer" })
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))

  revalidatePath(`/trips/${tripId}`)
}

export async function getTripActivities(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return []

  const acts = await db
    .select({
      id: tripActivities.id,
      dayOffset: tripActivities.dayOffset,
      startMins: tripActivities.startMins,
      endMins: tripActivities.endMins,
      title: tripActivities.title,
      isOpen: tripActivities.isOpen,
      isPrivate: tripActivities.isPrivate,
      category: tripActivities.category,
      color: tripActivities.color,
      location: tripActivities.location,
      createdBy: tripActivities.createdBy,
    })
    .from(tripActivities)
    .where(eq(tripActivities.tripId, tripId))

  // Filter out private activities that belong to other users
  const visible = acts.filter(
    (a) => !a.isPrivate || a.createdBy === session.user.id
  )

  if (visible.length === 0) return []

  // Fetch attendees for all visible open activities
  const openIds = visible.filter((a) => a.isOpen).map((a) => a.id)
  const attendeeRows = openIds.length > 0
    ? await db
        .select({
          activityId: activityAttendees.activityId,
          userId: activityAttendees.userId,
          displayName: profiles.displayName,
        })
        .from(activityAttendees)
        .innerJoin(profiles, eq(activityAttendees.userId, profiles.id))
        .where(inArray(activityAttendees.activityId, openIds))
    : []

  return visible.map((a) => {
    const attendees = attendeeRows
      .filter((r) => r.activityId === a.id)
      .map((r) => ({ userId: r.userId, displayName: r.displayName }))
    return {
      ...a,
      attendees,
      iAmAttending: attendees.some((att) => att.userId === session.user.id),
    }
  })
}

export async function addTripActivity(
  tripId: string,
  activity: {
    dayOffset: number
    startMins: number
    endMins: number
    title: string
    isOpen?: boolean
    isPrivate?: boolean
    category?: string | null
    color?: string | null
    location?: string | null
  }
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  if (!activity.title.trim()) return { error: "Activity title is required." }
  if (activity.endMins <= activity.startMins) return { error: "End time must be after start time." }

  const isOpen = activity.isOpen ?? true
  const isPrivate = activity.isPrivate ?? false

  const [inserted] = await db.insert(tripActivities).values({
    tripId,
    createdBy: session.user.id,
    dayOffset: activity.dayOffset,
    startMins: activity.startMins,
    endMins: activity.endMins,
    title: activity.title.trim(),
    isOpen: isOpen ? 1 : 0,
    isPrivate: isPrivate ? 1 : 0,
    category: activity.category ?? null,
    color: activity.color ?? null,
    location: activity.location?.trim() || null,
  }).returning()

  // Auto-add creator as attendee on open activities
  if (isOpen && inserted?.id) {
    await db.insert(activityAttendees).values({
      activityId: inserted.id,
      userId: session.user.id,
    })
  }

  revalidatePath(`/trips/${tripId}/itinerary`)
  return { id: inserted?.id }
}

export async function deleteTripActivity(tripId: string, activityId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [activity] = await db
    .select()
    .from(tripActivities)
    .where(and(eq(tripActivities.id, activityId), eq(tripActivities.tripId, tripId)))

  if (!activity) return { error: "Activity not found." }
  if (activity.createdBy !== session.user.id) {
    const [membership] = await db
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
    if (membership?.role !== "organizer") return { error: "You can only delete your own activities." }
  }

  await db.delete(tripActivities).where(eq(tripActivities.id, activityId))
  revalidatePath(`/trips/${tripId}/itinerary`)
}

export async function toggleActivityAttendance(activityId: string, tripId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  const [existing] = await db
    .select()
    .from(activityAttendees)
    .where(
      and(
        eq(activityAttendees.activityId, activityId),
        eq(activityAttendees.userId, session.user.id)
      )
    )

  if (existing) {
    await db
      .delete(activityAttendees)
      .where(
        and(
          eq(activityAttendees.activityId, activityId),
          eq(activityAttendees.userId, session.user.id)
        )
      )
  } else {
    await db.insert(activityAttendees).values({
      activityId,
      userId: session.user.id,
    })
  }

  revalidatePath(`/trips/${tripId}/itinerary`)
}

export async function updateActivityCategory(
  activityId: string,
  tripId: string,
  category: string | null,
  color: string | null
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [activity] = await db
    .select()
    .from(tripActivities)
    .where(and(eq(tripActivities.id, activityId), eq(tripActivities.tripId, tripId)))

  if (!activity) return { error: "Activity not found." }

  // Only creator can edit personal activities; any member can edit open ones
  if (!activity.isOpen && activity.createdBy !== session.user.id) {
    return { error: "Only the creator can edit this activity." }
  }

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  await db
    .update(tripActivities)
    .set({ category, color })
    .where(eq(tripActivities.id, activityId))

  revalidatePath(`/trips/${tripId}/itinerary`)
}

export async function getTripIdeas(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return []

  const [ideas, votes] = await Promise.all([
    db.select({
      id: tripIdeas.id,
      text: tripIdeas.text,
      createdBy: tripIdeas.createdBy,
      creatorName: profiles.displayName,
      createdAt: tripIdeas.createdAt,
    })
    .from(tripIdeas)
    .innerJoin(profiles, eq(tripIdeas.createdBy, profiles.id))
    .where(eq(tripIdeas.tripId, tripId))
    .orderBy(tripIdeas.createdAt),
    db.select({ ideaId: ideaVotes.ideaId, userId: ideaVotes.userId })
      .from(ideaVotes)
      .innerJoin(tripIdeas, eq(ideaVotes.ideaId, tripIdeas.id))
      .where(eq(tripIdeas.tripId, tripId)),
  ])

  const voteCounts: Record<string, number> = {}
  const myVotes = new Set<string>()
  for (const v of votes) {
    voteCounts[v.ideaId] = (voteCounts[v.ideaId] ?? 0) + 1
    if (v.userId === session.user.id) myVotes.add(v.ideaId)
  }

  return ideas
    .map((i) => ({ ...i, voteCount: voteCounts[i.id] ?? 0, iVoted: myVotes.has(i.id) }))
    .sort((a, b) => b.voteCount - a.voteCount || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
}

export async function addTripIdea(tripId: string, text: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  const trimmed = text.trim()
  if (!trimmed) return { error: "Idea cannot be empty." }

  await db.insert(tripIdeas).values({ tripId, createdBy: session.user.id, text: trimmed })
  revalidatePath(`/trips/${tripId}`)
}

export async function deleteTripIdea(tripId: string, ideaId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [idea] = await db
    .select()
    .from(tripIdeas)
    .where(and(eq(tripIdeas.id, ideaId), eq(tripIdeas.tripId, tripId)))
  if (!idea) return { error: "Idea not found." }

  if (idea.createdBy !== session.user.id) {
    const [membership] = await db
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
    if (membership?.role !== "organizer") return { error: "You can only delete your own ideas." }
  }

  await db.delete(tripIdeas).where(eq(tripIdeas.id, ideaId))
  revalidatePath(`/trips/${tripId}`)
}

export async function getPackingList(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return []

  const items = await db
    .select({
      id: packingItems.id,
      label: packingItems.label,
      createdBy: packingItems.createdBy,
      creatorName: profiles.displayName,
      createdAt: packingItems.createdAt,
    })
    .from(packingItems)
    .innerJoin(profiles, eq(packingItems.createdBy, profiles.id))
    .where(eq(packingItems.tripId, tripId))
    .orderBy(packingItems.createdAt)

  if (items.length === 0) return []

  const checks = await db
    .select()
    .from(packingChecks)
    .where(inArray(packingChecks.itemId, items.map((i) => i.id)))

  return items.map((item) => ({
    ...item,
    packedByIds: checks.filter((c) => c.itemId === item.id).map((c) => c.userId),
    iPackedIt: checks.some((c) => c.itemId === item.id && c.userId === session.user!.id),
  }))
}

export async function addPackingItem(tripId: string, label: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  const trimmed = label.trim()
  if (!trimmed) return { error: "Item cannot be empty." }

  const [inserted] = await db.insert(packingItems).values({ tripId, createdBy: session.user.id, label: trimmed }).returning()
  revalidatePath(`/trips/${tripId}`)
  return { id: inserted?.id }
}

export async function deletePackingItem(tripId: string, itemId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [item] = await db
    .select()
    .from(packingItems)
    .where(and(eq(packingItems.id, itemId), eq(packingItems.tripId, tripId)))
  if (!item) return { error: "Item not found." }

  if (item.createdBy !== session.user.id) {
    const [membership] = await db
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
    if (membership?.role !== "organizer") return { error: "You can only delete your own items." }
  }

  await db.delete(packingItems).where(eq(packingItems.id, itemId))
  revalidatePath(`/trips/${tripId}`)
}

export async function togglePackingCheck(tripId: string, itemId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  const [existing] = await db
    .select()
    .from(packingChecks)
    .where(and(eq(packingChecks.itemId, itemId), eq(packingChecks.userId, session.user.id)))

  if (existing) {
    await db
      .delete(packingChecks)
      .where(and(eq(packingChecks.itemId, itemId), eq(packingChecks.userId, session.user.id)))
  } else {
    await db.insert(packingChecks).values({ itemId, userId: session.user.id })
  }

  revalidatePath(`/trips/${tripId}`)
}

export async function getMemberFlights(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return []

  return db
    .select({
      id: memberFlights.id,
      userId: memberFlights.userId,
      displayName: profiles.displayName,
      direction: memberFlights.direction,
      flightNumber: memberFlights.flightNumber,
      departureAirport: memberFlights.departureAirport,
      arrivalAirport: memberFlights.arrivalAirport,
      departureAt: memberFlights.departureAt,
      arrivalAt: memberFlights.arrivalAt,
      notes: memberFlights.notes,
    })
    .from(memberFlights)
    .innerJoin(profiles, eq(memberFlights.userId, profiles.id))
    .where(eq(memberFlights.tripId, tripId))
    .orderBy(memberFlights.departureAt)
}

export async function addMemberFlight(
  tripId: string,
  data: {
    direction: "outbound" | "return"
    flightNumber: string
    departureAirport?: string
    arrivalAirport?: string
    departureAt: string
    arrivalAt: string
    notes?: string
  }
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  if (!data.flightNumber.trim()) return { error: "Flight number is required." }
  if (!data.departureAt || !data.arrivalAt) return { error: "Departure and arrival times are required." }
  if (data.departureAt >= data.arrivalAt) return { error: "Arrival must be after departure." }

  await db.insert(memberFlights).values({
    tripId,
    userId: session.user.id,
    direction: data.direction,
    flightNumber: data.flightNumber.trim().toUpperCase(),
    departureAirport: data.departureAirport?.trim().toUpperCase() || null,
    arrivalAirport: data.arrivalAirport?.trim().toUpperCase() || null,
    departureAt: data.departureAt,
    arrivalAt: data.arrivalAt,
    notes: data.notes?.trim() || null,
  })

  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/itinerary`)
}

export async function deleteMemberFlight(tripId: string, flightId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [flight] = await db
    .select()
    .from(memberFlights)
    .where(and(eq(memberFlights.id, flightId), eq(memberFlights.tripId, tripId)))
  if (!flight) return { error: "Flight not found." }

  if (flight.userId !== session.user.id) {
    const [membership] = await db
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
    if (membership?.role !== "organizer") return { error: "You can only delete your own flights." }
  }

  await db.delete(memberFlights).where(eq(memberFlights.id, flightId))
  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/itinerary`)
}

export async function getHotelStays(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return []

  return db
    .select({
      id: hotelStays.id,
      userId: hotelStays.userId,
      displayName: profiles.displayName,
      name: hotelStays.name,
      address: hotelStays.address,
      checkIn: hotelStays.checkIn,
      checkOut: hotelStays.checkOut,
      confirmationNumber: hotelStays.confirmationNumber,
      notes: hotelStays.notes,
    })
    .from(hotelStays)
    .innerJoin(profiles, eq(hotelStays.userId, profiles.id))
    .where(eq(hotelStays.tripId, tripId))
    .orderBy(hotelStays.checkIn)
}

export async function addHotelStay(
  tripId: string,
  data: {
    name: string
    address?: string
    checkIn: string
    checkOut: string
    confirmationNumber?: string
    notes?: string
  }
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  if (!data.name.trim()) return { error: "Hotel name is required." }
  if (!data.checkIn || !data.checkOut) return { error: "Check-in and check-out dates are required." }
  if (data.checkIn >= data.checkOut) return { error: "Check-out must be after check-in." }

  await db.insert(hotelStays).values({
    tripId,
    userId: session.user.id,
    name: data.name.trim(),
    address: data.address?.trim() || null,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    confirmationNumber: data.confirmationNumber?.trim() || null,
    notes: data.notes?.trim() || null,
  })

  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/itinerary`)
}

export async function deleteHotelStay(tripId: string, hotelId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [hotel] = await db
    .select()
    .from(hotelStays)
    .where(and(eq(hotelStays.id, hotelId), eq(hotelStays.tripId, tripId)))
  if (!hotel) return { error: "Hotel not found." }

  if (hotel.userId !== session.user.id) {
    const [membership] = await db
      .select()
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
    if (membership?.role !== "organizer") return { error: "You can only delete your own hotels." }
  }

  await db.delete(hotelStays).where(eq(hotelStays.id, hotelId))
  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/itinerary`)
}

// ── Idea voting ─────────────────────────────────────────────────────────────

export async function toggleIdeaVote(tripId: string, ideaId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  const [existing] = await db
    .select()
    .from(ideaVotes)
    .where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.userId, session.user.id)))

  if (existing) {
    await db.delete(ideaVotes).where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.userId, session.user.id)))
  } else {
    await db.insert(ideaVotes).values({ ideaId, userId: session.user.id })
  }
  revalidatePath(`/trips/${tripId}`)
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export async function getExpenses(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return []

  return db
    .select({
      id: tripExpenses.id,
      paidBy: tripExpenses.paidBy,
      payerName: profiles.displayName,
      amount: tripExpenses.amount,
      description: tripExpenses.description,
      createdAt: tripExpenses.createdAt,
    })
    .from(tripExpenses)
    .innerJoin(profiles, eq(tripExpenses.paidBy, profiles.id))
    .where(eq(tripExpenses.tripId, tripId))
    .orderBy(desc(tripExpenses.createdAt))
}

export async function addExpense(tripId: string, paidBy: string, amountCents: number, description: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  if (amountCents <= 0) return { error: "Amount must be greater than zero." }
  if (!description.trim()) return { error: "Description is required." }

  const [inserted] = await db
    .insert(tripExpenses)
    .values({ tripId, paidBy, amount: amountCents, description: description.trim() })
    .returning({ id: tripExpenses.id })

  revalidatePath(`/trips/${tripId}`)
  return { id: inserted?.id }
}

export async function deleteExpense(tripId: string, expenseId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [expense] = await db
    .select()
    .from(tripExpenses)
    .where(and(eq(tripExpenses.id, expenseId), eq(tripExpenses.tripId, tripId)))
  if (!expense) return { error: "Expense not found." }

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (expense.paidBy !== session.user.id && membership?.role !== "organizer") {
    return { error: "You can only delete your own expenses." }
  }

  await db.delete(tripExpenses).where(eq(tripExpenses.id, expenseId))
  revalidatePath(`/trips/${tripId}`)
}

// ── Member preferences ────────────────────────────────────────────────────────

export async function getMemberPreferences(tripId: string) {
  const session = await auth()
  if (!session?.user?.id) return []

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return []

  return db
    .select({
      userId: memberPreferences.userId,
      displayName: profiles.displayName,
      budget: memberPreferences.budget,
      vibes: memberPreferences.vibes,
      notes: memberPreferences.notes,
    })
    .from(memberPreferences)
    .innerJoin(profiles, eq(memberPreferences.userId, profiles.id))
    .where(eq(memberPreferences.tripId, tripId))
}

export async function saveMemberPreferences(tripId: string, budget: string | null, vibes: string | null, notes: string | null) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [membership] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))
  if (!membership) return { error: "Not a member of this trip." }

  await db
    .insert(memberPreferences)
    .values({ tripId, userId: session.user.id, budget: budget as never, vibes, notes })
    .onConflictDoUpdate({
      target: [memberPreferences.tripId, memberPreferences.userId],
      set: { budget: sql`excluded.budget`, vibes: sql`excluded.vibes`, notes: sql`excluded.notes` },
    })

  revalidatePath(`/trips/${tripId}`)
}
