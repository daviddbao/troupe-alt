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
  startHour: integer("start_hour").notNull(),
  endHour: integer("end_hour").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("group"),
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
