import { pgTable, text, integer, timestamp, json } from "drizzle-orm/pg-core"

export type TripPreferences = {
  nights?: number
  ptoDays?: number
  geography?: string
  weather?: "Warm" | "Cold" | "Mild" | "Any"
  notes?: string
}

export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

export const trips = pgTable("trips", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => profiles.id),
  preferences: json("preferences").$type<TripPreferences>(),
  scheduledStart: text("scheduled_start"), // ISO date YYYY-MM-DD, null = not yet scheduled
  scheduledEnd: text("scheduled_end"),     // ISO date YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow(),
})

export const tripMembers = pgTable("trip_members", {
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  role: text("role")
    .notNull()
    .default("member"),
})

export const availabilityBlocks = pgTable("availability_blocks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // ISO date string: YYYY-MM-DD
})

export const tripActivities = pgTable("trip_activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => profiles.id),
  date: text("date").notNull(),
  startMins: integer("start_mins").notNull(), // minutes from midnight, e.g. 570 = 9:30am
  endMins: integer("end_mins").notNull(),
  title: text("title").notNull(),
  isOpen: integer("is_open").notNull().default(1),   // 1 = others can join (default)
  isPrivate: integer("is_private").notNull().default(0), // 1 = only visible to creator
  category: text("category"),
  color: text("color"),   // hex override; falls back to category default
  location: text("location"),
})

export const activityAttendees = pgTable("activity_attendees", {
  activityId: text("activity_id")
    .notNull()
    .references(() => tripActivities.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
})

export const tripInvites = pgTable("trip_invites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at"),
})
