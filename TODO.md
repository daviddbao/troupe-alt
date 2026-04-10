# Troupe — To-Do List

## Completed
- [x] Database schema: profiles, trips, trip_members, availability_blocks, trip_invites
- [x] Auth: NextAuth v5 credentials provider, login/signup pages, server actions
- [x] Dashboard: trip list with create-trip form, member count, scheduled badge
- [x] Trip detail page: members, availability status, preferences, invite link
- [x] Availability calendar: multi-select, erase mode, holiday chips, clear-all confirm, toast
- [x] Range selection on availability calendar (click anchor → click end selects all dates between)
- [x] Preferences form: nights, PTO, geography, weather chips, notes (organizer-only edit)
- [x] Account page: display name edit, sign out
- [x] Invite flow: on-demand generation, /invite/[code] auto-joins and redirects
- [x] Aggregate availability calendar heatmap (server-rendered best windows, client heatmap)
- [x] Trip scheduling: organizer picks dates from best windows, green banner on trip detail
- [x] Smart best windows: filtered by trip preferences minimum nights (sliding window algorithm)
- [x] Trip actions: rename, delete, leave (with confirmation dialogs)
- [x] Activity planning grid: CSS grid, 7am–10pm rows, days as columns, group/personal activities
- [x] Itinerary page: gated on scheduled dates, links from trip detail
- [x] Unit tests: auth actions (6), trip actions (7) with in-memory SQLite
- [x] Vitest config: exclude E2E, resolve tsconfig paths
- [x] Production build fix: remove inline "use server" from client component

## Fix Now (correctness / trust)
- [ ] **Activity feedback**: show toast on successful add/delete; surface error message on failure
- [ ] **Itinerary grid React key warning**: `HOURS.map()` renders a fragment without a `key` prop — add key to the fragment (itinerary-grid.tsx line ~142)

## Fix Soon (UX gaps)
- [ ] **Organizer transfer**: block organizer from leaving a trip without first promoting another member; prevent orphaned trips
- [ ] **Empty itinerary hint**: show an onboarding message when no activities exist yet ("Tap any slot to add an activity")
- [ ] **Disable past dates on availability calendar**: past dates should be unselectable in react-day-picker

## Optional / Low Stakes
- [ ] **Invite expiry**: permanent links are fine for friend groups — only worth adding if trips become sensitive or app scales up

## Nice to Have
- [ ] **Trip date on dashboard card**: show the scheduled date range (e.g. "Jun 14–18") on the dashboard card instead of just "Scheduled"
- [ ] **Aggregate calendar legend**: add a small legend explaining that darker = more people available
- [ ] **Real-time updates**: availability/activity changes visible to other members without manual refresh (polling or SSE)
- [ ] **Notifications**: email nudge when a friend joins or submits availability
- [ ] **Playwright E2E tests**: full signup → trip → availability → invite → aggregate flow
