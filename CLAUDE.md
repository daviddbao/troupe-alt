@AGENTS.md

# Troupe — Claude Code Guide

## Git Workflow
- Work directly on `master`. Do not create feature branches unless explicitly asked.
- After completing any task: commit with a clear message and `git push origin master`.
- No PRs needed — this is a solo project.

## Stack
- **Framework:** Next.js 16.2.2 (App Router, TypeScript, Turbopack)
- **DB local:** SQLite via `better-sqlite3` + Drizzle ORM
- **DB prod:** PostgreSQL via Supabase (ref: `derfjihbvwjgclwlqhuw`, pooler port 6543)
- **Auth:** NextAuth.js v5 — credentials provider, JWT strategy
- **UI:** Tailwind CSS v4 + shadcn/ui, react-day-picker
- **Deploy:** Vercel (project: `troupe-alt`)

## Local Dev
```bash
npm install && npm run dev   # http://localhost:3000
npm run db:push              # apply schema to local SQLite
```

## Production
- Vercel env vars set: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`
- Supabase DDL: TCP ports 5432/6543 are blocked in this environment — run migrations via Management API only:
  ```bash
  curl -X POST "https://api.supabase.com/v1/projects/derfjihbvwjgclwlqhuw/database/query" \
    -H "Authorization: Bearer <PAT>" -H "Content-Type: application/json" \
    -d '{"query": "ALTER TABLE ..."}'
  ```
- **Rotate the Supabase PAT — it was shared in plaintext in prior sessions.**

## Next.js 16 — Breaking Changes
- **Async params:** `params` and `searchParams` must be awaited
  ```tsx
  type Params = Promise<{ id: string }>
  export default async function Page(props: { params: Params }) {
    const { id } = await props.params
  }
  ```
- **Auth proxy:** route protection is in `proxy.ts`, not `middleware.ts`
- **TS errors fail builds** — fix all type errors before pushing

## Data Model
| Table | Key Columns |
|---|---|
| `profiles` | id, email, display_name, password_hash |
| `trips` | id, name, created_by, status (planning/booking/during/post), scheduled_start, scheduled_end, preferences (JSON) |
| `trip_members` | trip_id, user_id, role (organizer/member) |
| `trip_invites` | trip_id, code, expires_at |
| `availability_blocks` | id, trip_id, user_id, date |
| `member_preferences` | trip_id, user_id (composite PK), vibes, trip_length, pto_budget, weather, notes |
| `trip_ideas` | id, trip_id, created_by, text |
| `idea_votes` | idea_id, user_id |
| `trip_activities` | id, trip_id, created_by, day_offset, start_mins, end_mins, title, category, color, location, is_open, is_private |
| `activity_attendees` | activity_id, user_id |
| `member_flights` | id, trip_id, user_id, direction (outbound/return), flight_number, departure_airport, arrival_airport, departure_at, arrival_at, notes |
| `hotel_stays` | id, trip_id, user_id, name, address, check_in, check_out, confirmation_number, notes |
| `packing_items` | id, trip_id, created_by, label |
| `packing_checks` | item_id, user_id |
| `trip_expenses` | id, trip_id, paid_by, amount (cents), description, split_with (JSON array of user_ids, null = all members) |

## Routes
| Route | Description |
|---|---|
| `/login`, `/signup` | Auth |
| `/dashboard` | User's trips list |
| `/trips/[id]` | Trip detail — Plan / Logistics / Ideas tabs |
| `/trips/[id]/itinerary` | Day-offset itinerary grid |
| `/trips/[id]/preferences` | Organizer preferences |
| `/account` | Display name, sign out |
| `/invite/[code]` | Join trip via invite link |

## Trip Detail — Tab Structure
**Plan:** Group availability (best windows + aggregate calendar + schedule for organizer) → Preferences → My Availability (inline `AvailabilityCalendar`) → People → Invite link

**Logistics:** Flights · Hotels · Packing list · Expenses

**Ideas:** Ideas board (add/upvote/delete)

Itinerary card only shown when trip has scheduled dates.

## Key Behaviors
- Auth-gated via `proxy.ts`; creator auto-added as organizer
- Availability: tap = anchor, tap again = single day, tap another = range fill; erase mode; holiday chips (US federal); drag on desktop
- Aggregate calendar: colored rings = Everyone/Most/Half/Some coverage
- Suggested windows: min length derived from member `trip_length` prefs (Weekend→2, 4-5 days→4, 1 week→7); organizer's `nights` pref takes priority
- Expense splits: each expense stores which members share it (`split_with`); null = all members
- Packing list: quick-add chips for 11 travel essentials
- Optimistic UI on all mutations — roll back on server error
- Delete buttons: always visible on mobile, hover-only on desktop (`sm:opacity-0 sm:group-hover:opacity-100`)

## Architecture
- RSC for data fetching, `"use client"` for interaction; `ReactNode` children passed server→client via `TripTabs`
- `useTransition` + server actions for all mutations; `router.refresh()` after schedule/clear
- `onSaved?: () => void` on `AvailabilityCalendar` — calls instead of redirecting
- Page-level `Promise.all` with 11 parallel fetches on trip detail page
- Itinerary uses `day_offset` from `scheduled_start`, not wall-clock dates
- Collapsible sections use shared `CollapsibleCard` / `Chevron` from `components/ui/collapsible-card.tsx`
