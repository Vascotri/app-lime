# PRD — Google Calendar as the source of truth for events

**App:** app-lime · **Author:** PM · **Date:** 2026-10-15 · **Status:** awaiting CEO sign-off

## Problem / user need

Vasco and Jennifer already live in Google Calendar — it is on both phones, it notifies them, and
Jennifer is on Android where app-lime has no native presence. Today app-lime's events are invisible
there, so the family calendar exists in two places and neither is complete. They also cannot tell at
a glance **who** is doing a given thing: who takes the kids to school, who lets the cleaner in.

## Outcome

One family calendar, visible everywhere they already look, where every event says who is responsible.
Entering an event in either app-lime or Google Calendar is enough — no double entry, no "which one is
right?"

## Approach (decided)

Google Calendar becomes the **system of record** for events; app-lime becomes a nicer interface onto
it. A single shared "Family" calendar, owned by one account and shared read/write with the other.

This is deliberately *not* a two-way sync between two databases. Two masters would require conflict
resolution, duplicate detection and loop suppression — a large amount of machinery whose only purpose
is cleaning up after a choice we did not have to make. With one copy of each event, "changes appear in
both places" is true by construction.

Assignee is stored in the event's `extendedProperties.private.assignee` and mirrored to the event's
`colorId`, so it is structured for the app and visible to humans inside Google Calendar.

Tasks and shopping stay in Supabase, untouched.

## Scope

**In (v1)**
- Shared "Family" Google Calendar; app reads and writes it via the Calendar API.
- Google sign-in gains calendar scope + offline access; refresh tokens stored per user.
- Calendar panel reads live from Google for the next 14 days, recurrence expanded by Google.
- Create / edit / delete an event from app-lime writes through to Google.
- Assignee (Vasco / Jennifer / Both) persisted in `extendedProperties`, mirrored to event colour.
- Recurrence switches to RRULE, replacing the hand-rolled engine.
- One-time migration of existing Supabase events into the calendar; `events` table dropped.

**Out (later)**
- Push notifications / reminders — Google Calendar already notifies on both phones. Revisit only if
  task reminders (which Google does not hold) are still wanted.
- Webhooks for live push into the app. The app reads on load; that is fresh enough for two people.
- Caching events locally. Add only if load latency is felt.
- Inviting people outside the family, free/busy, multiple calendars, per-person calendars.
- Syncing **tasks** or **shopping** to Google.

## UX

Visually the Calendar panel barely changes — same agenda, same chips. What changes is where the data
lives and that edits propagate.

- **Connect (one-time):** after sign-in, a prompt to connect Google Calendar. Explains plainly that
  events will live in a shared Family calendar both of them can see.
- **Loading:** existing skeleton; now covers a network round trip to Google rather than Supabase.
- **Empty:** unchanged.
- **Error (new, and it matters more now):** Google unreachable or token expired must say so and offer
  *Reconnect* — it must never look like "no events". This is the gap already queued for the panels.
- **Success:** create an event in app-lime → it appears in both Google Calendars. Edit it on
  Jennifer's phone → app-lime shows the change on next load.
- **Assignee:** unchanged in the app (chip). In Google Calendar it reads as the event's colour.

## Success measure

**Zero double entry:** for two weeks after launch, every family event exists exactly once, and no
event is created in Google Calendar that a user then re-creates in app-lime (or vice versa).
Counter-metric: no duplicate or orphaned events after the migration.

## Risks / unknowns

- **OAuth publishing status — blocking.** The consent screen is in *Testing*, where Google expires
  refresh tokens after **7 days**; sync would die weekly. Must be set to *In Production*. No Google
  verification review is required, but each user sees an "unverified app" warning once.
  ([docs](https://developers.google.com/identity/protocols/oauth2))
- **This is a rewrite of the events half of the app**, not an addition: `recurrence.ts` and its 17
  tests are deleted, the `events` table is dropped, auth changes. Tasks and shopping are unaffected.
- **Migration is one-way.** Pushing existing events into Google and dropping the table is not
  reversible without a backup. Snapshot the table first.
- **Latency.** Every dashboard load now waits on Google (~300–600ms). Mitigated by the existing
  skeleton; caching deferred until felt.
- **Availability.** If Google is down, there is no calendar. Acceptable for a family app; tasks and
  shopping keep working.
- **Colour is not self-describing.** In Google Calendar, blue means Vasco only if you remember it.
  Accepted at decision time; the app remains the place where it is labelled.

### Needs CEO sign-off
- **New affordance:** the "Connect Google Calendar" step and the *Reconnect* error path.
- **Irreversible:** the one-time migration and dropping the `events` table.
- **Colour mapping** (Vasco / Jennifer / Both → which colours) — naming-adjacent, CEO's call.

## Slices

Each is its own PR, and each leaves the app working.

1. **Auth groundwork** — calendar scope, offline access, `google_tokens` table, connect/reconnect UI.
   Nothing reads the calendar yet. *Ships dark.*
2. **Read path** — Calendar panel reads live from Google behind a flag; Supabase events still render
   when the flag is off. Lets us compare both side by side.
3. **Write path** — create / edit / delete from app-lime write through to Google, incl. assignee via
   `extendedProperties` + colour.
4. **Recurrence on RRULE** — replace the hand-rolled engine; delete `recurrence.ts` and its tests.
5. **Migrate and clean up** — snapshot, backfill existing events into the calendar, drop the table,
   remove the flag.

Slices 1–2 are safe to ship before committing: the app keeps working off Supabase throughout, and we
only cross the one-way door at slice 5.
