"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { trips, tripMembers, tripInvites, profiles, availabilityBlocks, tripActivities, activityAttendees } from "@/lib/db/schema"
import { eq, and, inArray, desc } from "drizzle-orm"
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

  // Fetch member counts in one query
  const tripIds = rows.map((r) => r.trip.id)
  const allMembers = await db
    .select({ tripId: tripMembers.tripId })
    .from(tripMembers)
    .where(inArray(tripMembers.tripId, tripIds))

  const memberCounts: Record<string, number> = {}
  for (const m of allMembers) {
    memberCounts[m.tripId] = (memberCounts[m.tripId] ?? 0) + 1
  }

  return rows.map((r) => ({
    ...r.trip,
    memberCount: memberCounts[r.trip.id] ?? 1,
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

  // Clean up activity attendances before leaving
  const tripActivityIds = await db
    .select({ id: tripActivities.id })
    .from(tripActivities)
    .where(eq(tripActivities.tripId, tripId))

  if (tripActivityIds.length > 0) {
    await db
      .delete(activityAttendees)
      .where(
        and(
          eq(activityAttendees.userId, session.user.id),
          inArray(activityAttendees.activityId, tripActivityIds.map((a) => a.id))
        )
      )
  }

  await db
    .delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)))

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
      date: tripActivities.date,
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
    date: string
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
    date: activity.date,
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
