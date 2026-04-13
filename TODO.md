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
- [x] Production build fix: remove inline "use server" from client component
- [x] Activity add/delete toast + error feedback
- [x] Itinerary grid React key warning fixed
- [x] Signup friction removed — display name derived from email, 2-field form
- [x] Availability save: toast + auto-redirect back to trip page
- [x] Join trip confirmation: "You've joined X!" banner after invite redirect
- [x] Dashboard: new trip is a modal button when trips exist, inline form on empty state
- [x] Itinerary link: full green button in scheduled banner, impossible to miss
- [x] Past dates disabled on availability calendar

## Fix Soon (UX gaps)
- [x] **Organizer transfer**: promote-then-leave flow; sole organizer shown member list to pick successor
- [x] **Trip date on dashboard card**: shows actual date range (e.g. "Jun 14–18")

## Up Next
- [ ] **Playwright E2E tests**: full signup → trip → availability → invite → aggregate flow

## Completed (recent)
- [x] **Verify itinerary UI**: grid confirmed complete — half-hour slots, categories, open/private, location, attendees; fixed stale `type` cast in itinerary page
- [x] **Aggregate calendar legend**: color swatches for All / 75%+ / 50%+ / 25%+ / Some

## Deferred (not high priority for friend-group scale)
- [ ] **Invite expiry**: permanent links are fine — only worth adding if app scales
- [ ] **Real-time updates**: availability/activity changes visible without manual refresh (polling or SSE)
- [ ] **Notifications**: email nudge when a friend joins or submits availability
