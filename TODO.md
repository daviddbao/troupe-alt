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
- [ ] **Organizer transfer**: block organizer from leaving without promoting someone first; prevent orphaned trips
- [ ] **Trip date on dashboard card**: show scheduled date range (e.g. "Jun 14–18") instead of just "Scheduled"

## Optional / Low Stakes
- [ ] **Invite expiry**: permanent links are fine for friend groups — only worth adding if app scales
- [ ] **Aggregate calendar legend**: small legend explaining darker = more people available
- [ ] **Real-time updates**: availability/activity changes visible without manual refresh (polling or SSE)
- [ ] **Notifications**: email nudge when a friend joins or submits availability
- [ ] **Playwright E2E tests**: full signup → trip → availability → invite → aggregate flow
