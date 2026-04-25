@AGENTS.md

# Troupe — Claude Code Guide

## What We're Building
A lightweight group trip planning app for friend groups (3–10 people). Solves date coordination, preference gathering, logistics, and itinerary planning in one place.

## Stack
- **Framework:** Next.js 16.2.2 (App Router, TypeScript, Turbopack default)
- **Database (local):** SQLite via `better-sqlite3` + Drizzle ORM
- **Database (production):** PostgreSQL via Supabase (project ref: `derfjihbvwjgclwlqhuw`, pooler port 6543)
- **Auth:** NextAuth.js v5 (credentials provider — email/password, JWT strategy)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Calendar:** react-day-picker
- **Deployment:** Vercel (project ID: `prj_1KrpzYFqtHPauGEkXoFEcUM4FAzC`, project name: `troupe-alt`)

## Local Dev
```bash
npm install
npm run dev       # http://localhost:3000
npm run db:push   # apply schema to local SQLite
```

No Docker, no external services required locally.

## Production Config
Vercel env vars already set: `DATABASE_URL` (Supabase pooler), `AUTH_SECRET`, `NEXTAUTH_URL`.
Supabase migrations: run via Management API — `POST https://api.supabase.com/v1/projects/derfjihbvwjgclwlqhuw/database/query` with PAT.
**IMPORTANT: Rotate the Supabase PAT and the Vercel token — both were shared in plaintext in previous sessions.**

## Next.js 16 Key Conventions (Breaking Changes from 14/15)
- **Async Request APIs**: `cookies()`, `headers()`, `params`, `searchParams` must ALL be awaited
  ```tsx
  type Params = Promise<{ id: string }>
  export default async function Page(props: { params: Params }) {
    const { id } = await props.params
  }
  ```
- **Middleware → Proxy**: Auth/route protection lives in `proxy.ts` (not `middleware.ts`), exports `proxy` function
- **Turbopack**: Default for `next dev` and `next build` — no flag needed
- **No AMP, no `next lint`** (use ESLint CLI directly), no runtime config
- **TS errors fail builds**: `ignoreBuildErrors` was removed — fix all type errors before pushing

## Data Model
| Table | Key Columns |
|---|---|
| `trips` | id, name, created_by, status (planning/booking/on_trip/post), scheduled_start, scheduled_end, preferences (JSON text) |
| `trip_members` | trip_id, user_id, role (organizer/member) |
| `availability_blocks` | trip_id, user_id, date |
| `trip_invites` | trip_id, code, expires_at |
| `profiles` | id, display_name, email, password_hash |
| `member_flights` | id, trip_id, user_id, airline, flight_number, departure_airport, arrival_airport, departure_time, arrival_time, notes |
| `hotel_stays` | id, trip_id, user_id, name, address, check_in, check_out, confirmation_number, notes |
| `packing_items` | id, trip_id, label, created_by |
| `packing_checks` | trip_id, item_id, user_id (who marked it packed) |
| `trip_activities` | id, trip_id, title, day_offset, start_minute, end_minute, created_by |
| `trip_ideas` | id, trip_id, text, created_by |

## Route Structure
| Route | Description |
|---|---|
| `/login` | Email/password login |
| `/signup` | Email/password signup |
| `/dashboard` | User's trips list |
| `/trips/[id]` | Trip detail — Plan / Logistics / Ideas tabs |
| `/trips/[id]/itinerary` | Day-offset itinerary grid (flights, hotels, activities) |
| `/trips/[id]/preferences` | Organizer sets trip preferences |
| `/account` | Display name, sign out |
| `/invite/[code]` | Join trip via invite link |

Note: `/trips/[id]/availability` still exists as a standalone page but the calendar is now also embedded inline on the trip detail page.

## Trip Detail Page — Tab Structure
**Plan tab:**
1. Group availability (best windows list + aggregate calendar + schedule trip for organizer)
2. Preferences (organizer sets; others view)
3. My availability — full `AvailabilityCalendar` embedded inline (no redirect needed; `onSaved={() => {}}`)
4. People (member list with availability checkmarks)
5. Invite link

**Logistics tab:** Flights, Hotels, Packing list

**Ideas tab:** Ideas board (add/upvote/delete)

Itinerary link: subtle bordered card, only shown when trip has scheduled dates.

## Key Behaviors
- Auth-gated routes via `proxy.ts`
- Creator auto-added as organizer on trip creation
- Availability: tap to toggle, tap start+end for range selection, erase mode, clear-all confirm, holiday quick-add chips (US federal holiday weekends, future dates only), toast on quick-add
- Touch drag disabled on mobile (`pointerType === "touch"` check); desktop supports pointer-drag to paint dates
- Weekday chips removed
- Aggregate calendar legend: Everyone / Most / Half / Some / Few (no % labels)
- Trip status: planning → booking → on_trip → post (organizer-controlled pill; drives UI surfacing in future)
- Optimistic UI throughout: all add/delete ops update state immediately, roll back on server error
- Delete buttons: visible on mobile, hover-only on desktop (`sm:opacity-0 sm:group-hover:opacity-100`)
- Itinerary grid: "Full trip" and "Day" view toggle; hotel bars span trip duration; flight cards in day view
- Itinerary uses day offsets from `scheduled_start` (not wall-clock dates) — activities/flights/hotels stored as day_offset
- `addTripActivity` and `addPackingItem` both return `{ id }` so client replaces optimistic temp ID with real DB ID

## Architecture Patterns
- Server components fetch data; client components handle interaction
- `ReactNode` children passed from server → client tab components (`TripTabs`)
- `useTransition` + server action for all mutations
- `onSaved?: () => void` prop on `AvailabilityCalendar` — when provided, calls it instead of redirecting after save
- `leaveTrip` cleans up all user rows across 5 tables in parallel

## Design Principles
- Mobile-first, min 44px touch targets
- Low friction — no unnecessary steps
- Casual tone — this is for friends, not enterprise

## What's Next / Ideas
- Trip status-driven UI: surface relevant sections based on planning → booking → on_trip → post stage
- Cost splitting for post-trip stage
- Push notifications when group members add availability
