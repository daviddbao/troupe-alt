import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "@/lib/db/schema"

export function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.pragma("foreign_keys = ON")

  // Create tables matching schema.ts — ids are JS-side UUIDs so no SQL DEFAULT needed
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      preferences TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      scheduled_start TEXT,
      scheduled_end TEXT
    );

    CREATE TABLE IF NOT EXISTS trip_activities (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'group'
    );

    CREATE TABLE IF NOT EXISTS trip_members (
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member'
    );

    CREATE TABLE IF NOT EXISTS availability_blocks (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_invites (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      expires_at INTEGER
    );
  `)

  return drizzle(sqlite, { schema })
}

export type TestDb = ReturnType<typeof createTestDb>
