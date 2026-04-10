import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export type TripPreferences = {
  nights?: number
  ptoDays?: number
  geography?: string
  weather?: "Warm" | "Cold" | "Mild" | "Any"
  notes?: string
}

export const profiles = sqliteTable("profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
})

export const trips = sqliteTable("trips", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => profiles.id),
  preferences: text("preferences", { mode: "json" }).$type<TripPreferences>(),
  scheduledStart: text("scheduled_start"), // ISO date YYYY-MM-DD, null = not yet scheduled
  scheduledEnd: text("scheduled_end"),     // ISO date YYYY-MM-DD
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`
  ),
})

export const tripMembers = sqliteTable("trip_members", {
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["organizer", "member"] })
    .notNull()
    .default("member"),
})

export const availabilityBlocks = sqliteTable("availability_blocks", {
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

export const tripActivities = sqliteTable("trip_activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => profiles.id),
  date: text("date").notNull(),          // ISO date YYYY-MM-DD
  startHour: integer("start_hour").notNull(), // 0–23
  endHour: integer("end_hour").notNull(),     // 1–24, must be > startHour
  title: text("title").notNull(),
  type: text("type", { enum: ["group", "personal"] }).notNull().default("group"),
})

export const tripInvites = sqliteTable("trip_invites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
})
