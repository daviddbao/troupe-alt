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
- [x] Unit tests: auth actions, trip actions, organizer flows, best-windows algorithm
- [x] Production build fix: remove inline "use server" from client component
- [x] Activity add/delete toast + error feedback
- [x] Signup friction reduced — display name derived from email, 2-field form
- [x] Availability save: toast + auto-redirect back to trip page
- [x] Join trip confirmation: "You've joined X!" banner after invite redirect
- [x] Dashboard: new trip is a modal button when trips exist, inline form on empty state
- [x] Itinerary link: full green button in scheduled banner
- [x] Past dates disabled on availability calendar
- [x] Organizer transfer: promote-then-leave flow
- [x] Trip date on dashboard card: shows actual date range (e.g. "Jun 14–18")
- [x] Drag-to-select on availability calendar (pointer events)
- [x] Weekday bulk-select chips (Suns–Sats) — toggles all of that weekday ±6 months
- [x] Holiday chips toggle (remove if already selected)
- [x] 4-stage trip status: Planning → Booking → On Trip → Completed
- [x] Aggregate calendar legend: color swatches
- [x] Password show/hide toggle on login and signup
- [x] Holiday chips expanded to 7-day window (±3 days) to include surrounding weekdays
- [x] Bug fix: activity attendees cleaned up when member leaves trip
- [x] Bug fix: scheduleTripDates validates start ≤ end
- [x] UX: preferences card labeled as optional

## Not Yet Built — Booking/During/Post Stages
These status labels exist but have no dedicated features yet:
- [ ] **Booking stage**: hotel/flight logging, booking confirmation tracking
- [ ] **During trip**: day-of itinerary view, reminders (bring sunscreen, etc.)
- [ ] **Post trip**: cost logging, reimbursement splitting, photo sharing (needs storage)

## Known Limitations
- [ ] **Forgot password**: requires email provider (Resend, SendGrid) — skip until needed
- [ ] **Playwright E2E tests**: 12/13 fail due to NextAuth session bug in test env only; app itself works

## Deferred
- [ ] **Invite expiry**: permanent links are fine for friend-group scale
- [ ] **Real-time updates**: manual refresh acceptable at this scale
- [ ] **Notifications**: email nudges when friends join or submit availability

## Gating & Requirements Notes
| Gate | Reason | Removable? |
|---|---|---|
| Itinerary requires scheduled dates | Grid is date-column based — no dates = no grid | No (architectural) |
| Scheduling requires organizer | Only organizer picks final dates | Intentional |
| Best windows require availability data | Algorithm needs submissions to compute | Inherent |
| Booking/During/Post stages | Status labels only — no new UI unlocked yet | Will unlock as features are built |
| Preferences | Labeled optional, skip freely | Already optional |
| Forgot password | Needs email delivery service | External dependency |
