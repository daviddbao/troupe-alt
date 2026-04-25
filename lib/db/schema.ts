import { pgTable, text, integer, timestamp, json } from "drizzle-orm/pg-core"

export type TripPreferences = {
  nights?: number
  ptoDays?: number
  geography?: string
  weather?: "Warm" | "Cold" | "Mild" | "Any"
  notes?: string
}

export type MemberPrefs = {
  budget?: "budget" | "mid" | "luxury"
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

export type TripStatus = "planning" | "booking" | "during" | "post"

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
  status: text("status").$type<TripStatus>().notNull().default("planning"),
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
  dayOffset: integer("day_offset").notNull().default(0), // 0 = Day 1
  startMins: integer("start_mins").notNull(),
  endMins: integer("end_mins").notNull(),
  title: text("title").notNull(),
  isOpen: integer("is_open").notNull().default(1),
  isPrivate: integer("is_private").notNull().default(0),
  category: text("category"),
  color: text("color"),
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

export const tripIdeas = pgTable("trip_ideas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => profiles.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

export const packingItems = pgTable("packing_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => profiles.id),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

export const packingChecks = pgTable("packing_checks", {
  itemId: text("item_id")
    .notNull()
    .references(() => packingItems.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
})

export const memberFlights = pgTable("member_flights", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  direction: text("direction").notNull().default("outbound"), // "outbound" | "return"
  flightNumber: text("flight_number").notNull(),
  departureAirport: text("departure_airport"),
  arrivalAirport: text("arrival_airport"),
  departureAt: text("departure_at").notNull(), // "YYYY-MM-DDTHH:MM"
  arrivalAt: text("arrival_at").notNull(),     // "YYYY-MM-DDTHH:MM"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const hotelStays = pgTable("hotel_stays", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  checkIn: text("check_in").notNull(),   // "YYYY-MM-DD"
  checkOut: text("check_out").notNull(), // "YYYY-MM-DD"
  confirmationNumber: text("confirmation_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
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

export const ideaVotes = pgTable("idea_votes", {
  ideaId: text("idea_id")
    .notNull()
    .references(() => tripIdeas.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
})

export const tripExpenses = pgTable("trip_expenses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  paidBy: text("paid_by")
    .notNull()
    .references(() => profiles.id),
  amount: integer("amount").notNull(), // cents
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

export const memberPreferences = pgTable("member_preferences", {
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  budget: text("budget").$type<MemberPrefs["budget"]>(),
  vibes: text("vibes"), // comma-separated: "beach,city,mountains" etc
  notes: text("notes"),
})
