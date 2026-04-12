# Study Calendar — Design Spec

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

A study calendar integrated into the app that lets users schedule study sessions manually, extract dates from a syllabus via AI, and optionally sync events to Google Calendar. The calendar is displayed as a dedicated page (`/calendar`) and as a "This Week" widget on the dashboard.

---

## Goals

- Let users see upcoming study sessions, exams, and deadlines in one place
- Auto-extract dates/events from a syllabus (file upload or pasted text)
- Optionally generate a study plan (sessions leading up to deadlines/exams)
- Push events to Google Calendar for users who sign in with Google

---

## Non-Goals (for this iteration)

- Reading from Google Calendar to avoid scheduling conflicts
- Supporting non-Google users connecting a calendar (GCal only, Google sign-in only)
- Two-way sync (app is write-only to GCal)
- Mobile-native calendar views

---

## Data Model

New Prisma model added to `prisma/schema.prisma`:

```prisma
model StudyEvent {
  id          String   @id @default(cuid())
  userId      String
  title       String
  date        DateTime
  duration    Int?          // minutes; null for all-day events (exams, deadlines)
  type        String        // 'study' | 'exam' | 'assignment' | 'other'
  guideId     String?       // optional link to a Guide
  gcalEventId String?       // Google Calendar event ID, set after push; null if not synced
  notes       String?
  createdAt   DateTime @default(now())

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  guide Guide? @relation(fields: [guideId], references: [id], onDelete: SetNull)
}
```

Add the inverse relation to `User` and `Guide` models.

**Google Calendar tokens** are stored in the existing `Account` model (`access_token`, `refresh_token`, `scope`). Incremental OAuth adds the `https://www.googleapis.com/auth/calendar.events` scope to the user's Google account record.

---

## Pages

### `/calendar` — Full calendar page

- Month/week toggle view
- Color-coded events:
  - Study sessions — charcoal (`var(--accent)`)
  - Exams — red (`#dc2626`)
  - Assignments/deadlines — amber (`#d97706`)
  - Other — muted gray
- Navigation: prev/next month (or week)
- Header actions:
  - **↑ Import syllabus** — opens the two-step import modal
  - **+ Add event** — opens a simple event creation modal
  - GCal sync status badge (shown only for Google sign-in users with Calendar scope granted)
- Click a day cell to quick-add an event on that date
- Click an existing event to view/edit/delete it

### Dashboard widget — "This Week"

Added to the right column of `app/dashboard/page.tsx`, above the Quick Generate panel.

- Lists events for the current calendar week (Mon–Sun)
- Each row: color dot, event title, date/time, type badge
- Header: "This Week" label + "View calendar →" link
- Empty state: "Nothing scheduled this week. Add events →"
- Stats row on dashboard gains a third tile: event count for this week

---

## API Routes

All routes under `app/api/calendar/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `events/` | List events for current user; accepts `?from=&to=` date range |
| POST | `events/` | Create a single event |
| POST | `events/batch/` | Create multiple events at once (used by import flow) |
| PUT | `events/[id]/` | Update an event |
| DELETE | `events/[id]/` | Delete an event; also deletes from GCal if `gcalEventId` is set |
| POST | `extract/` | AI extracts dates from text or uploaded file; returns candidate events |
| POST | `generate-plan/` | AI generates study sessions between today and a target event date |
| GET | `gcal/connect/` | Initiates incremental OAuth to add Calendar scope |
| GET | `gcal/callback/` | OAuth callback; updates Account record with new tokens + scope |
| POST | `gcal/sync/[id]/` | Pushes a single event to GCal; stores returned event ID |

---

## Google Calendar Integration

**Eligibility:** Only users whose `Account` provider is `"google"` and whose `scope` includes `https://www.googleapis.com/auth/calendar.events`.

**Connect flow:**
1. If a Google sign-in user visits `/calendar` without Calendar scope, the page shows a banner: "Connect Google Calendar to sync your events." with a "Connect" button.
2. Clicking it hits `GET /api/calendar/gcal/connect`, which redirects to Google OAuth with `access_type=offline`, `prompt=consent`, and the Calendar scope appended to existing scopes.
3. Callback at `GET /api/calendar/gcal/callback` updates the `Account` row with the new `access_token`, `refresh_token`, and `scope`.

**Push on create/update:**
- After saving a `StudyEvent` to the DB, if the user has Calendar scope, push the event to GCal using the stored `access_token` (refresh via `refresh_token` if expired).
- Store the returned GCal event ID in `StudyEvent.gcalEventId`.

**Delete:**
- If `gcalEventId` is set, delete the GCal event before removing the DB row.

**Token refresh:** Use the `refresh_token` from the `Account` row to obtain a new `access_token` when needed. Update `Account.access_token` and `Account.expires_at` after refresh.

---

## Syllabus Import Flow

**Step 1 — Input:** Modal with two tabs: "Upload file" (PDF/DOCX/TXT) and "Paste text". User provides one or the other, then clicks "Extract dates with AI →".

**Step 2 — Review:** The `POST /api/calendar/extract` endpoint sends the content to the Claude API with a structured extraction prompt. Returns a list of candidate events:
```ts
{ title: string; date: string; type: 'exam' | 'assignment' | 'other' }[]
```
The review screen shows each extracted event with its inferred type, an edit button (inline rename + date correction), and a remove button.

**Step 3 — Optional study plan:** After reviewing, a prompt asks: "Auto-generate study sessions?" If yes, calls `POST /api/calendar/generate-plan` with the confirmed events. The AI generates sessions (e.g. 3 sessions per exam, spread over the days before) and returns them as additional candidate events for the user to confirm.

**Step 4 — Add to calendar:** Clicking "Add to calendar →" creates all confirmed events via `POST /api/calendar/events` (batch), pushes to GCal if connected.

---

## AI Extraction Prompt Strategy

`POST /api/calendar/extract` uses the Claude API with a system prompt instructing it to return a JSON array of events. The user content is the raw syllabus text (or extracted text from the uploaded file). The response is parsed and validated before being returned to the client.

`POST /api/calendar/generate-plan` receives the list of confirmed deadline/exam events and generates study sessions. Inputs: event list, today's date. Output: list of study session events with dates and durations.

Both endpoints use the `TokenUsage` model (already in the schema) to track token consumption per operation.

---

## Component Structure

```
app/calendar/page.tsx          — calendar page (client component)
app/dashboard/page.tsx         — add ThisWeekWidget to right column
components/calendar/
  CalendarGrid.tsx             — month/week grid view
  CalendarEvent.tsx            — event chip in grid + list item in widget
  ThisWeekWidget.tsx           — dashboard widget
  AddEventModal.tsx            — manual event creation form
  ImportSyllabusModal.tsx      — two-step import flow
  EventDetailModal.tsx         — view/edit/delete an event
lib/gcal.ts                    — Google Calendar API client (push, delete, token refresh)
lib/calendarAI.ts              — Claude API calls for extract + generate-plan
```

---

## Theming

Follows the existing app theme exactly:
- Background: `var(--background)` (`#faf9f6`)
- Surface/cards: `var(--surface)` (`#f2f0ec`)
- Borders: `var(--border)` (`#e0ddd8`)
- Accent: `var(--accent)` (`#44403c`)
- Muted text: `var(--muted)` (`#888070`)
- Display font: `var(--font-display)` (Playfair)
- Event colors are semantic overrides: red for exams, amber for deadlines

---

## Out of Scope / Future

- Reading GCal to avoid scheduling conflicts (designed for: `access_type=offline` and scope structure already accommodate adding read scope)
- Recurring study sessions
- Shared calendars (group study)
- Push notifications / reminders
