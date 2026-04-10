@AGENTS.md

# Troupe — Claude Code Guide

## What We're Building
A lightweight group trip planning app for friend groups (3–10 people). Solves date coordination and preference gathering in one place.

## Stack
- **Framework:** Next.js 16.2.2 (App Router, TypeScript, Turbopack default)
- **Database:** SQLite via `better-sqlite3` + Drizzle ORM
- **Auth:** NextAuth.js v5 (credentials provider — email/password)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Calendar:** react-day-picker
- **Deployment (future):** Vercel + Supabase (Postgres + Supabase Auth)

## Local Dev
```bash
npm install
npm run dev       # http://localhost:3000
npm run db:push   # apply schema to local SQLite
```

No Docker, no external services required. Everything runs locally.

## Next.js 16 Key Conventions (Breaking Changes from 14/15)
- **Async Request APIs**: `cookies()`, `headers()`, `params`, `searchParams` must ALL be awaited
  ```tsx
  // Dynamic route params
  type Params = Promise<{ id: string }>
  export default async function Page(props: { params: Params }) {
    const { id } = await props.params
  }
  ```
- **Middleware → Proxy**: Auth/route protection lives in `proxy.ts` (not `middleware.ts`), exports `proxy` function
- **Turbopack**: Default for `next dev` and `next build` — no flag needed
- **No AMP, no `next lint`** (use ESLint CLI directly), no runtime config

## Migration Plan (when ready to deploy)
- Drizzle: swap SQLite driver → Postgres connection string
- Auth: swap NextAuth credentials → Supabase Auth (or keep NextAuth with Postgres adapter)
- UI and business logic stay untouched

## Data Model
| Table | Key Columns |
|---|---|
| trips | id, name, created_by, preferences (JSON text) |
| trip_members | trip_id, user_id, role (organizer/member) |
| availability_blocks | trip_id, user_id, date |
| trip_invites | trip_id, code, expires_at |
| profiles | id, display_name, email, password_hash |

## Route Structure
| Route | Description |
|---|---|
| `/login` | Email/password login |
| `/signup` | Email/password signup |
| `/dashboard` | User's trips list |
| `/trips/[id]` | Trip detail (members, availability status, preferences link) |
| `/trips/[id]/availability` | Availability calendar |
| `/trips/[id]/preferences` | Per-member trip preferences |
| `/account` | Display name, sign out |
| `/invite/[code]` | Join trip via invite link |

## Key Behaviors
- Auth-gated routes via `proxy.ts` (redirect unauthenticated → /login)
- Creator auto-added as organizer on trip creation
- Availability: click to add, click to remove, erase mode for batch remove, clear-all with confirm dialog
- Holiday quick-add chips (US federal holiday weekends, future dates only)
- Toast notification on quick-add (~2.5s)
- Amber CTA banner on trip detail if user hasn't added availability
- Mobile-first: min 44px touch targets, horizontal-scroll chip rows

## Design Principles
- Mobile-first
- Low friction — no unnecessary steps
- Casual tone — this is for friends, not enterprise
