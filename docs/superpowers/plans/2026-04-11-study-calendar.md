# Study Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a study calendar to tldr. — a dedicated `/calendar` page, a dashboard widget, syllabus import with AI date extraction, optional auto-generated study plans, and Google Calendar sync for Google sign-in users.

**Architecture:** Events are stored in a new `StudyEvent` Postgres table (app is source of truth). On create/update/delete, if the user signed in with Google and has Calendar scope, events are pushed to Google Calendar via the REST API. The syllabus import flow uses the Claude API to extract dates from text or uploaded files, then lets the user review before committing.

**Tech Stack:** Next.js 16 (App Router), Prisma 7, PostgreSQL, NextAuth 5, Anthropic SDK (`@anthropic-ai/sdk`), Google Calendar REST API (plain fetch — no `googleapis` package), React 19, Tailwind + CSS custom properties.

---

## File Map

**New files:**
- `types/calendar.ts` — shared TS types for StudyEvent, CandidateEvent
- `lib/gcal.ts` — Google Calendar REST client (push, delete, refresh token)
- `lib/calendarAI.ts` — Claude API calls: extract dates, generate study plan
- `app/api/calendar/events/route.ts` — GET (list), POST (create single)
- `app/api/calendar/events/[id]/route.ts` — PUT (update), DELETE
- `app/api/calendar/events/batch/route.ts` — POST (create multiple, used by import)
- `app/api/calendar/extract/route.ts` — POST: AI date extraction
- `app/api/calendar/generate-plan/route.ts` — POST: AI study plan generation
- `app/api/calendar/gcal/connect/route.ts` — GET: start incremental OAuth
- `app/api/calendar/gcal/callback/route.ts` — GET: handle OAuth callback
- `app/api/calendar/gcal/sync/[id]/route.ts` — POST: manually re-push event to GCal
- `components/calendar/CalendarGrid.tsx` — month/week grid view
- `components/calendar/CalendarEvent.tsx` — event chip used in grid and widget
- `components/calendar/AddEventModal.tsx` — manual event creation form
- `components/calendar/EventDetailModal.tsx` — view/edit/delete an event
- `components/calendar/ImportSyllabusModal.tsx` — two-step import flow
- `components/calendar/ThisWeekWidget.tsx` — dashboard widget
- `app/calendar/page.tsx` — full calendar page
- `__tests__/api/calendar/events.test.ts`
- `__tests__/api/calendar/extract.test.ts`
- `__tests__/api/calendar/generate-plan.test.ts`
- `__tests__/lib/gcal.test.ts`
- `__tests__/components/ThisWeekWidget.test.tsx`

**Modified files:**
- `prisma/schema.prisma` — add `StudyEvent` model + inverse relations
- `components/NavTabs.tsx` — add Calendar tab
- `app/dashboard/page.tsx` — add ThisWeekWidget + third stats tile

---

## Task 1: Add StudyEvent to the database schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `StudyEvent` model and inverse relations**

In `prisma/schema.prisma`, add after the `Guide` model:

```prisma
model StudyEvent {
  id          String   @id @default(cuid())
  userId      String
  title       String
  date        DateTime
  duration    Int?
  type        String
  guideId     String?
  gcalEventId String?
  notes       String?
  createdAt   DateTime @default(now())

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  guide Guide? @relation(fields: [guideId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([date])
}
```

Add `studyEvents StudyEvent[]` to the `User` model's field list.

Add `studyEvents StudyEvent[]` to the `Guide` model's field list.

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_study_events
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client generates without error**

```bash
npx prisma generate
```

Expected: exits 0, no type errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add StudyEvent model to schema"
```

---

## Task 2: Shared TypeScript types

**Files:**
- Create: `types/calendar.ts`

- [ ] **Step 1: Create the types file**

```ts
// types/calendar.ts

export type EventType = 'study' | 'exam' | 'assignment' | 'other'

export interface StudyEventData {
  id: string
  title: string
  date: string        // ISO 8601
  duration: number | null  // minutes; null = all-day
  type: EventType
  guideId: string | null
  gcalEventId: string | null
  notes: string | null
  createdAt: string
}

// Returned by the AI extraction endpoint before the user confirms
export interface CandidateEvent {
  title: string
  date: string        // ISO 8601 date or datetime
  type: 'exam' | 'assignment' | 'other'
  duration?: number   // minutes; only set by generate-plan
}

// Payload for creating a single event
export interface CreateEventPayload {
  title: string
  date: string
  duration?: number | null
  type: EventType
  guideId?: string | null
  notes?: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add types/calendar.ts
git commit -m "feat: add calendar TypeScript types"
```

---

## Task 3: Events CRUD API

**Files:**
- Create: `app/api/calendar/events/route.ts`
- Create: `app/api/calendar/events/[id]/route.ts`
- Create: `app/api/calendar/events/batch/route.ts`
- Create: `__tests__/api/calendar/events.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/calendar/events.test.ts`:

```ts
/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    studyEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn(),
    },
  },
}))
jest.mock('@/lib/gcal', () => ({
  pushEventToGcal: jest.fn(),
  deleteEventFromGcal: jest.fn(),
  getGcalTokens: jest.fn(),
}))

import { GET, POST } from '@/app/api/calendar/events/route'
import { PUT, DELETE } from '@/app/api/calendar/events/[id]/route'
import { POST as BATCH } from '@/app/api/calendar/events/batch/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const mockSession = { user: { id: 'user-1' } }

function makeReq(method: string, body?: unknown, url = 'http://localhost/api/calendar/events') {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/calendar/events', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(401)
  })

  it('returns events for authenticated user', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.findMany as jest.Mock).mockResolvedValue([
      { id: 'ev-1', title: 'Exam 1', date: new Date('2026-04-22'), duration: null,
        type: 'exam', guideId: null, gcalEventId: null, notes: null, createdAt: new Date() },
    ])
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].title).toBe('Exam 1')
  })
})

describe('POST /api/calendar/events', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq('POST', { title: 'Test', date: '2026-04-22', type: 'exam' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    const res = await POST(makeReq('POST', { title: 'Test' }))
    expect(res.status).toBe(400)
  })

  it('creates event and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.create as jest.Mock).mockResolvedValue({ id: 'ev-1' })
    const res = await POST(makeReq('POST', { title: 'Exam 1', date: '2026-04-22T00:00:00Z', type: 'exam' }))
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/calendar/events/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ev-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when event not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ev-1' }) })
    expect(res.status).toBe(404)
  })

  it('deletes event and returns 200', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', userId: 'user-1', gcalEventId: null })
    ;(prisma.studyEvent.delete as jest.Mock).mockResolvedValue({})
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ev-1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/calendar/events/batch', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await BATCH(makeReq('POST', []))
    expect(res.status).toBe(401)
  })

  it('returns 400 for non-array body', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    const res = await BATCH(makeReq('POST', { not: 'array' }))
    expect(res.status).toBe(400)
  })

  it('creates multiple events and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.createMany as jest.Mock).mockResolvedValue({ count: 2 })
    const events = [
      { title: 'Exam 1', date: '2026-04-22T00:00:00Z', type: 'exam' },
      { title: 'HW due', date: '2026-04-16T23:59:00Z', type: 'assignment' },
    ]
    const res = await BATCH(makeReq('POST', events))
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/api/calendar/events.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `lib/gcal.ts` stub** (full implementation in Task 4 — just enough to unblock tests)

```ts
// lib/gcal.ts
export async function pushEventToGcal(
  _accessToken: string,
  _event: { title: string; date: string; duration: number | null; notes: string | null }
): Promise<string> {
  return ''
}

export async function deleteEventFromGcal(
  _accessToken: string,
  _gcalEventId: string
): Promise<void> {}

export async function getGcalTokens(
  _userId: string
): Promise<{ accessToken: string; hasCalendarScope: boolean } | null> {
  return null
}
```

- [ ] **Step 4: Create events GET + POST route**

```ts
// app/api/calendar/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal } from '@/lib/gcal'
import type { StudyEventData, CreateEventPayload } from '@/types/calendar'

function rowToData(r: {
  id: string; title: string; date: Date; duration: number | null
  type: string; guideId: string | null; gcalEventId: string | null
  notes: string | null; createdAt: Date
}): StudyEventData {
  return {
    id: r.id,
    title: r.title,
    date: r.date.toISOString(),
    duration: r.duration,
    type: r.type as StudyEventData['type'],
    guideId: r.guideId,
    gcalEventId: r.gcalEventId,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const rows = await prisma.studyEvent.findMany({
    where: {
      userId: session.user.id,
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(rows.map(rowToData))
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: CreateEventPayload = await request.json().catch(() => null)
  if (!body?.title || !body?.date || !body?.type) {
    return NextResponse.json({ error: 'title, date, and type are required' }, { status: 400 })
  }

  const event = await prisma.studyEvent.create({
    data: {
      userId: session.user.id,
      title: body.title,
      date: new Date(body.date),
      duration: body.duration ?? null,
      type: body.type,
      guideId: body.guideId ?? null,
      notes: body.notes ?? null,
    },
  })

  // Push to GCal if connected
  const tokens = await getGcalTokens(session.user.id)
  if (tokens?.hasCalendarScope) {
    try {
      const gcalEventId = await pushEventToGcal(tokens.accessToken, {
        title: event.title,
        date: event.date.toISOString(),
        duration: event.duration,
        notes: event.notes,
      })
      await prisma.studyEvent.update({
        where: { id: event.id },
        data: { gcalEventId },
      })
    } catch {
      // GCal push failure is non-fatal
    }
  }

  return NextResponse.json(rowToData(event), { status: 201 })
}
```

- [ ] **Step 5: Create events PUT + DELETE route**

```ts
// app/api/calendar/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal, deleteEventFromGcal } from '@/lib/gcal'
import type { CreateEventPayload, StudyEventData } from '@/types/calendar'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.studyEvent.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body: Partial<CreateEventPayload> = await request.json().catch(() => ({}))
  const updated = await prisma.studyEvent.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
      ...(body.duration !== undefined ? { duration: body.duration } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.guideId !== undefined ? { guideId: body.guideId } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  })

  // Update GCal event if connected
  const tokens = await getGcalTokens(session.user.id)
  if (tokens?.hasCalendarScope && updated.gcalEventId) {
    try {
      await deleteEventFromGcal(tokens.accessToken, updated.gcalEventId)
      const newGcalId = await pushEventToGcal(tokens.accessToken, {
        title: updated.title,
        date: updated.date.toISOString(),
        duration: updated.duration,
        notes: updated.notes,
      })
      await prisma.studyEvent.update({ where: { id }, data: { gcalEventId: newGcalId } })
    } catch {
      // non-fatal
    }
  }

  const data: StudyEventData = {
    id: updated.id,
    title: updated.title,
    date: updated.date.toISOString(),
    duration: updated.duration,
    type: updated.type as StudyEventData['type'],
    guideId: updated.guideId,
    gcalEventId: updated.gcalEventId,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.studyEvent.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Delete from GCal first
  if (existing.gcalEventId) {
    const tokens = await getGcalTokens(session.user.id)
    if (tokens?.hasCalendarScope) {
      try {
        await deleteEventFromGcal(tokens.accessToken, existing.gcalEventId)
      } catch {
        // non-fatal
      }
    }
  }

  await prisma.studyEvent.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Create batch route**

```ts
// app/api/calendar/events/batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal } from '@/lib/gcal'
import type { CreateEventPayload } from '@/types/calendar'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: CreateEventPayload[] = await request.json().catch(() => null)
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an array of events' }, { status: 400 })
  }

  const data = body.map(e => ({
    userId: session.user.id,
    title: e.title,
    date: new Date(e.date),
    duration: e.duration ?? null,
    type: e.type,
    guideId: e.guideId ?? null,
    notes: e.notes ?? null,
  }))

  await prisma.studyEvent.createMany({ data })

  // Fetch the created events to push to GCal
  const tokens = await getGcalTokens(session.user.id)
  if (tokens?.hasCalendarScope) {
    // Best-effort: fire and forget for batch
    const created = await prisma.studyEvent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: data.length,
    })
    for (const ev of created) {
      try {
        const gcalEventId = await pushEventToGcal(tokens.accessToken, {
          title: ev.title,
          date: ev.date.toISOString(),
          duration: ev.duration,
          notes: ev.notes,
        })
        await prisma.studyEvent.update({ where: { id: ev.id }, data: { gcalEventId } })
      } catch {
        // non-fatal
      }
    }
  }

  return NextResponse.json({ ok: true, count: data.length }, { status: 201 })
}
```

- [ ] **Step 7: Run tests**

```bash
npx jest --no-coverage __tests__/api/calendar/events.test.ts
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/api/calendar/ lib/gcal.ts __tests__/api/calendar/events.test.ts
git commit -m "feat: add calendar events CRUD API"
```

---

## Task 4: Google Calendar lib + OAuth routes

**Files:**
- Modify: `lib/gcal.ts` (replace stub with full implementation)
- Create: `app/api/calendar/gcal/connect/route.ts`
- Create: `app/api/calendar/gcal/callback/route.ts`
- Create: `app/api/calendar/gcal/sync/[id]/route.ts`
- Create: `__tests__/lib/gcal.test.ts`

- [ ] **Step 1: Write failing tests for `lib/gcal.ts`**

Create `__tests__/lib/gcal.test.ts`:

```ts
/**
 * @jest-environment node
 */

jest.mock('@/lib/db', () => ({
  prisma: {
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

import { getGcalTokens, pushEventToGcal, deleteEventFromGcal } from '@/lib/gcal'
import { prisma } from '@/lib/db'

beforeEach(() => jest.clearAllMocks())

describe('getGcalTokens', () => {
  it('returns null when no Google account found', async () => {
    ;(prisma.account.findFirst as jest.Mock).mockResolvedValue(null)
    const result = await getGcalTokens('user-1')
    expect(result).toBeNull()
  })

  it('returns tokens with hasCalendarScope=false when scope missing', async () => {
    ;(prisma.account.findFirst as jest.Mock).mockResolvedValue({
      access_token: 'tok',
      refresh_token: 'ref',
      scope: 'openid email profile',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      providerAccountId: 'google-id-1',
    })
    const result = await getGcalTokens('user-1')
    expect(result?.hasCalendarScope).toBe(false)
  })

  it('returns tokens with hasCalendarScope=true when scope present', async () => {
    ;(prisma.account.findFirst as jest.Mock).mockResolvedValue({
      access_token: 'tok',
      refresh_token: 'ref',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      providerAccountId: 'google-id-1',
    })
    const result = await getGcalTokens('user-1')
    expect(result?.hasCalendarScope).toBe(true)
    expect(result?.accessToken).toBe('tok')
  })
})

describe('pushEventToGcal', () => {
  it('returns gcal event id on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'gcal-event-123' }),
    })
    const id = await pushEventToGcal('access-token', {
      title: 'Exam 1',
      date: '2026-04-22T09:00:00Z',
      duration: null,
      notes: null,
    })
    expect(id).toBe('gcal-event-123')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    await expect(
      pushEventToGcal('bad-token', { title: 'X', date: '2026-04-22T00:00:00Z', duration: null, notes: null })
    ).rejects.toThrow()
  })
})

describe('deleteEventFromGcal', () => {
  it('calls DELETE on GCal API', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await deleteEventFromGcal('access-token', 'gcal-event-123')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gcal-event-123'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/lib/gcal.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/gcal.ts`**

```ts
// lib/gcal.ts
import { prisma } from '@/lib/db'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GCAL_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GcalTokens {
  accessToken: string
  hasCalendarScope: boolean
}

export async function getGcalTokens(userId: string): Promise<GcalTokens | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
    select: { access_token: true, refresh_token: true, scope: true, expires_at: true, providerAccountId: true },
  })
  if (!account?.access_token) return null

  let accessToken = account.access_token

  // Refresh if expired (expires_at is Unix seconds)
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 60) {
    if (!account.refresh_token) return null
    const refreshed = await refreshAccessToken(account.refresh_token)
    accessToken = refreshed.access_token
    await prisma.account.update({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: account.providerAccountId } },
      data: {
        access_token: refreshed.access_token,
        expires_at: refreshed.expires_at,
      },
    })
  }

  return {
    accessToken,
    hasCalendarScope: (account.scope ?? '').includes(GCAL_SCOPE),
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Failed to refresh Google access token')
  const data = await res.json() as { access_token: string; expires_in: number }
  return {
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  }
}

export async function pushEventToGcal(
  accessToken: string,
  event: { title: string; date: string; duration: number | null; notes: string | null }
): Promise<string> {
  const isAllDay = !event.duration
  const startDate = new Date(event.date)
  const endDate = event.duration
    ? new Date(startDate.getTime() + event.duration * 60_000)
    : startDate

  const body = {
    summary: event.title,
    description: event.notes ?? '',
    start: isAllDay
      ? { date: startDate.toISOString().split('T')[0] }
      : { dateTime: startDate.toISOString(), timeZone: 'UTC' },
    end: isAllDay
      ? { date: endDate.toISOString().split('T')[0] }
      : { dateTime: endDate.toISOString(), timeZone: 'UTC' },
  }

  const res = await fetch(GCAL_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`GCal API error: ${res.status}`)
  const data = await res.json() as { id: string }
  return data.id
}

export async function deleteEventFromGcal(accessToken: string, gcalEventId: string): Promise<void> {
  const res = await fetch(`${GCAL_API}/${gcalEventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 410) {
    // 410 = already deleted; treat as success
    throw new Error(`GCal delete error: ${res.status}`)
  }
}
```

- [ ] **Step 4: Run gcal tests**

```bash
npx jest --no-coverage __tests__/lib/gcal.test.ts
```

Expected: all pass.

- [ ] **Step 5: Create GCal OAuth connect route**

```ts
// app/api/calendar/gcal/connect/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/gcal/callback`,
    response_type: 'code',
    scope: GCAL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: session.user.id,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
```

- [ ] **Step 6: Create GCal OAuth callback route**

```ts
// app/api/calendar/gcal/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')

  if (!code || !userId) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/calendar?gcal=error`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/gcal/callback`,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) throw new Error('Token exchange failed')

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
    }

    const account = await prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { providerAccountId: true, scope: true },
    })

    if (!account) throw new Error('No Google account found')

    // Merge scopes
    const existingScopes = (account.scope ?? '').split(' ').filter(Boolean)
    const newScopes = tokens.scope.split(' ').filter(Boolean)
    const mergedScope = [...new Set([...existingScopes, ...newScopes, GCAL_SCOPE])].join(' ')

    await prisma.account.update({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: account.providerAccountId } },
      data: {
        access_token: tokens.access_token,
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        scope: mergedScope,
      },
    })

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/calendar?gcal=connected`)
  } catch {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/calendar?gcal=error`)
  }
}
```

- [ ] **Step 7: Create GCal manual re-sync route**

```ts
// app/api/calendar/gcal/sync/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal, deleteEventFromGcal } from '@/lib/gcal'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const event = await prisma.studyEvent.findUnique({ where: { id } })
  if (!event || event.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const tokens = await getGcalTokens(session.user.id)
  if (!tokens?.hasCalendarScope) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 403 })
  }

  if (event.gcalEventId) {
    try { await deleteEventFromGcal(tokens.accessToken, event.gcalEventId) } catch { /* ok */ }
  }

  const gcalEventId = await pushEventToGcal(tokens.accessToken, {
    title: event.title,
    date: event.date.toISOString(),
    duration: event.duration,
    notes: event.notes,
  })

  await prisma.studyEvent.update({ where: { id }, data: { gcalEventId } })
  return NextResponse.json({ ok: true, gcalEventId })
}
```

- [ ] **Step 8: Run all calendar API tests**

```bash
npx jest --no-coverage __tests__/api/calendar/ __tests__/lib/gcal.test.ts
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add lib/gcal.ts app/api/calendar/gcal/ __tests__/lib/gcal.test.ts
git commit -m "feat: add Google Calendar lib and OAuth routes"
```

---

## Task 5: AI extraction and study plan generation

**Files:**
- Create: `lib/calendarAI.ts`
- Create: `app/api/calendar/extract/route.ts`
- Create: `app/api/calendar/generate-plan/route.ts`
- Create: `__tests__/api/calendar/extract.test.ts`
- Create: `__tests__/api/calendar/generate-plan.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/calendar/extract.test.ts`:

```ts
/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/calendarAI', () => ({
  extractDatesFromText: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  prisma: { tokenUsage: { create: jest.fn() } },
}))

import { POST } from '@/app/api/calendar/extract/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { extractDatesFromText } from '@/lib/calendarAI'

const mockSession = { user: { id: 'user-1' } }

beforeEach(() => jest.clearAllMocks())

describe('POST /api/calendar/extract', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/calendar/extract', {
      method: 'POST',
      body: JSON.stringify({ text: 'Exam: April 22' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no text provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest('http://localhost/api/calendar/extract', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns extracted events', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(extractDatesFromText as jest.Mock).mockResolvedValue([
      { title: 'Exam 1', date: '2026-04-22', type: 'exam' },
    ])
    const req = new NextRequest('http://localhost/api/calendar/extract', {
      method: 'POST',
      body: JSON.stringify({ text: 'Exam 1: April 22' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].type).toBe('exam')
  })
})
```

Create `__tests__/api/calendar/generate-plan.test.ts`:

```ts
/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/calendarAI', () => ({
  generateStudyPlan: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  prisma: { tokenUsage: { create: jest.fn() } },
}))

import { POST } from '@/app/api/calendar/generate-plan/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { generateStudyPlan } from '@/lib/calendarAI'

const mockSession = { user: { id: 'user-1' } }

beforeEach(() => jest.clearAllMocks())

describe('POST /api/calendar/generate-plan', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/calendar/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ events: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns generated study sessions', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(generateStudyPlan as jest.Mock).mockResolvedValue([
      { title: 'Study for Exam 1', date: '2026-04-20T15:00:00Z', type: 'study', duration: 60 },
    ])
    const req = new NextRequest('http://localhost/api/calendar/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ events: [{ title: 'Exam 1', date: '2026-04-22', type: 'exam' }] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].type).toBe('study')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/api/calendar/extract.test.ts __tests__/api/calendar/generate-plan.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create `lib/calendarAI.ts`**

```ts
// lib/calendarAI.ts
import { getClient } from '@/lib/anthropic'
import type { CandidateEvent } from '@/types/calendar'

export async function extractDatesFromText(text: string): Promise<{
  events: CandidateEvent[]
  inputTokens: number
  outputTokens: number
}> {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a date extraction assistant. Extract all academic dates, deadlines, and events from the provided text.
Return ONLY a valid JSON array. Each item must have:
- "title": string (brief descriptive name)
- "date": string (ISO 8601 format, e.g. "2026-04-22" or "2026-04-22T09:00:00Z" if time is specified)
- "type": one of "exam", "assignment", or "other"

If the year is ambiguous, assume the current or next upcoming year. Return [] if no dates found.`,
    messages: [{ role: 'user', content: text }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return { events: [], inputTokens: 0, outputTokens: 0 }

  let events: CandidateEvent[] = []
  try {
    const parsed = JSON.parse(content.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    events = Array.isArray(parsed) ? parsed : []
  } catch {
    events = []
  }

  return {
    events,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

export async function generateStudyPlan(
  events: CandidateEvent[],
  today: string
): Promise<{
  sessions: CandidateEvent[]
  inputTokens: number
  outputTokens: number
}> {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a study planner. Given a list of upcoming exams and deadlines, generate a set of study sessions leading up to each one.
Rules:
- Schedule 3–5 study sessions before each exam, spread evenly
- Schedule 1–2 review sessions before each assignment deadline
- Each session is 45–60 minutes
- Do not schedule sessions in the past (today is ${today})
- Space sessions at least 1 day apart for the same subject

Return ONLY a valid JSON array. Each item must have:
- "title": string (e.g. "Study for Exam 1")
- "date": ISO 8601 datetime string (e.g. "2026-04-20T15:00:00Z")
- "type": "study"
- "duration": number (minutes, 45 or 60)`,
    messages: [{
      role: 'user',
      content: `Today: ${today}\n\nUpcoming events:\n${JSON.stringify(events, null, 2)}`,
    }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return { sessions: [], inputTokens: 0, outputTokens: 0 }

  let sessions: CandidateEvent[] = []
  try {
    const parsed = JSON.parse(content.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    sessions = Array.isArray(parsed) ? parsed : []
  } catch {
    sessions = []
  }

  return {
    sessions,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
```

- [ ] **Step 4: Create extract route**

```ts
// app/api/calendar/extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { extractDatesFromText } from '@/lib/calendarAI'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  let text: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (file) {
      // For PDF/text files, read as text
      text = await file.text()
    }
  } else {
    const body = await request.json().catch(() => null)
    text = body?.text ?? null
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text or file is required' }, { status: 400 })
  }

  const { events, inputTokens, outputTokens } = await extractDatesFromText(text)

  await prisma.tokenUsage.create({
    data: {
      userId: session.user.id,
      operation: 'calendar-extract',
      inputTokens,
      outputTokens,
    },
  })

  return NextResponse.json(events)
}
```

- [ ] **Step 5: Create generate-plan route**

```ts
// app/api/calendar/generate-plan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { generateStudyPlan } from '@/lib/calendarAI'
import type { CandidateEvent } from '@/types/calendar'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { events: CandidateEvent[] } = await request.json().catch(() => null)
  if (!Array.isArray(body?.events)) {
    return NextResponse.json({ error: 'events array is required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]
  const { sessions, inputTokens, outputTokens } = await generateStudyPlan(body.events, today)

  await prisma.tokenUsage.create({
    data: {
      userId: session.user.id,
      operation: 'calendar-generate-plan',
      inputTokens,
      outputTokens,
    },
  })

  return NextResponse.json(sessions)
}
```

- [ ] **Step 6: Run AI tests**

```bash
npx jest --no-coverage __tests__/api/calendar/extract.test.ts __tests__/api/calendar/generate-plan.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/calendarAI.ts app/api/calendar/extract/ app/api/calendar/generate-plan/ __tests__/api/calendar/extract.test.ts __tests__/api/calendar/generate-plan.test.ts
git commit -m "feat: add AI date extraction and study plan generation"
```

---

## Task 6: Calendar page + grid + NavTabs

**Files:**
- Modify: `components/NavTabs.tsx`
- Create: `components/calendar/CalendarEvent.tsx`
- Create: `components/calendar/CalendarGrid.tsx`
- Create: `app/calendar/page.tsx`

- [ ] **Step 1: Add Calendar to NavTabs**

In `components/NavTabs.tsx`, change the `tabs` array:

```ts
const tabs = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Guides', href: '/guides' },
  { label: 'Groups', href: '/groups' },
  { label: 'Calendar', href: '/calendar' },
]
```

- [ ] **Step 2: Create `components/calendar/CalendarEvent.tsx`**

```tsx
// components/calendar/CalendarEvent.tsx
import type { StudyEventData, EventType } from '@/types/calendar'

const TYPE_STYLES: Record<EventType, { border: string; bg: string; text: string }> = {
  study:      { border: 'var(--accent)',  bg: 'var(--surface)', text: 'var(--accent)' },
  exam:       { border: '#dc2626',        bg: '#fef2f2',        text: '#dc2626'       },
  assignment: { border: '#d97706',        bg: '#fffbeb',        text: '#d97706'       },
  other:      { border: 'var(--muted)',   bg: 'var(--surface)', text: 'var(--muted)'  },
}

interface Props {
  event: StudyEventData
  onClick?: () => void
  /** 'chip' = compact grid chip; 'row' = dashboard widget row */
  variant?: 'chip' | 'row'
}

export default function CalendarEvent({ event, onClick, variant = 'chip' }: Props) {
  const style = TYPE_STYLES[event.type] ?? TYPE_STYLES.other

  if (variant === 'row') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 w-full text-left px-0 py-0 bg-transparent border-none cursor-pointer"
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: style.border, flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {event.title}
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {event.duration ? ` · ${event.duration} min` : ''}
          </span>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: style.bg, color: style.text }}
        >
          {event.type}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate border-l-2 cursor-pointer"
      style={{
        borderColor: style.border,
        background: style.bg,
        color: style.text,
        border: 'none',
        borderLeft: `2px solid ${style.border}`,
      }}
      title={event.title}
    >
      {event.title}
    </button>
  )
}
```

- [ ] **Step 3: Create `components/calendar/CalendarGrid.tsx`**

```tsx
// components/calendar/CalendarGrid.tsx
'use client'

import { useMemo } from 'react'
import CalendarEvent from './CalendarEvent'
import type { StudyEventData } from '@/types/calendar'

interface Props {
  year: number
  month: number   // 0-indexed
  events: StudyEventData[]
  onDayClick: (date: Date) => void
  onEventClick: (event: StudyEventData) => void
}

function getDaysInMonth(year: number, month: number) {
  const days: { date: Date; isCurrentMonth: boolean }[] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  // Pad start (Sunday=0)
  for (let i = 0; i < first.getDay(); i++) {
    days.push({ date: new Date(year, month, -first.getDay() + i + 1), isCurrentMonth: false })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  // Pad end to complete the last row
  while (days.length % 7 !== 0) {
    days.push({ date: new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1), isCurrentMonth: false })
  }
  return days
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarGrid({ year, month, events, onDayClick, onEventClick }: Props) {
  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const today = new Date()

  function eventsForDay(date: Date) {
    return events.filter(e => {
      const d = new Date(e.date)
      return d.getFullYear() === date.getFullYear()
        && d.getMonth() === date.getMonth()
        && d.getDate() === date.getDate()
    })
  }

  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Day headers */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {DAY_LABELS.map(d => (
          <div
            key={d}
            className="py-2 text-center"
            style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map(({ date, isCurrentMonth }, i) => {
          const dayEvents = eventsForDay(date)
          const today_ = isToday(date)
          return (
            <div
              key={i}
              onClick={() => onDayClick(date)}
              className="flex flex-col gap-1 cursor-pointer"
              style={{
                padding: '6px 8px',
                minHeight: 80,
                borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                borderBottom: i < days.length - 7 ? '1px solid var(--border)' : 'none',
                background: 'var(--background)',
                opacity: isCurrentMonth ? 1 : 0.4,
                outline: today_ ? '2px solid var(--accent)' : 'none',
                outlineOffset: -2,
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 22, height: 22,
                  borderRadius: '50%',
                  fontSize: 11,
                  fontWeight: 600,
                  color: today_ ? '#fff' : 'var(--foreground)',
                  background: today_ ? 'var(--accent)' : 'transparent',
                }}
              >
                {date.getDate()}
              </span>
              {dayEvents.slice(0, 3).map(ev => (
                <CalendarEvent
                  key={ev.id}
                  event={ev}
                  onClick={e => { e?.stopPropagation(); onEventClick(ev) }}
                />
              ))}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>+{dayEvents.length - 3} more</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/calendar/page.tsx`**

```tsx
// app/calendar/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import CalendarGrid from '@/components/calendar/CalendarGrid'
import AddEventModal from '@/components/calendar/AddEventModal'
import EventDetailModal from '@/components/calendar/EventDetailModal'
import ImportSyllabusModal from '@/components/calendar/ImportSyllabusModal'
import type { StudyEventData } from '@/types/calendar'

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const gcalParam = searchParams.get('gcal')

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<StudyEventData[]>([])
  const [loading, setLoading] = useState(true)
  const [hasGcalScope, setHasGcalScope] = useState<boolean | null>(null)

  // Modal state
  const [addModal, setAddModal] = useState<{ open: boolean; date?: Date }>({ open: false })
  const [detailModal, setDetailModal] = useState<{ open: boolean; event?: StudyEventData }>({ open: false })
  const [importModal, setImportModal] = useState(false)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const from = new Date(year, month, 1).toISOString()
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const res = await fetch(`/api/calendar/events?from=${from}&to=${to}`)
    if (res.ok) setEvents(await res.json())
    setLoading(false)
  }, [year, month])

  const fetchGcalStatus = useCallback(async () => {
    const res = await fetch('/api/calendar/events?from=2000-01-01&to=2000-01-01')
    // GCal status is returned from a dedicated endpoint; check Account scope
    // We infer it by calling a lightweight endpoint that returns gcal status
    const r = await fetch('/api/calendar/gcal/status')
    if (r.ok) {
      const { hasCalendarScope } = await r.json()
      setHasGcalScope(hasCalendarScope)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useEffect(() => { fetchGcalStatus() }, [fetchGcalStatus])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']

  return (
    <div className="flex flex-1 flex-col px-6 py-10 max-w-5xl mx-auto w-full gap-6">

      {/* GCal connect banner */}
      {hasGcalScope === false && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--muted)' }}>
            Connect Google Calendar to sync your events automatically.
          </span>
          <a
            href="/api/calendar/gcal/connect"
            className="text-sm font-semibold px-4 py-1.5 rounded"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Connect →
          </a>
        </div>
      )}

      {/* GCal success/error flash */}
      {gcalParam === 'connected' && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#f0f7f0', border: '1px solid #c4dcc4', color: '#4d7c4d' }}>
          Google Calendar connected successfully.
        </div>
      )}
      {gcalParam === 'error' && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
          Could not connect Google Calendar. Please try again.
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            Study Calendar
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Your study sessions, exams &amp; deadlines
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {hasGcalScope && (
            <span
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#f0f7f0', border: '1px solid #c4dcc4', color: '#4d7c4d' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4d7c4d', display: 'inline-block' }} />
              Syncing to Google Calendar
            </span>
          )}
          <button
            onClick={() => setImportModal(true)}
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
          >
            ↑ Import syllabus
          </button>
          <button
            onClick={() => setAddModal({ open: true })}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            + Add event
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ width: 28, height: 28, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14 }}
        >
          ‹
        </button>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)', minWidth: 130 }}
        >
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ width: 28, height: 28, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14 }}
        >
          ›
        </button>
      </div>

      {/* Grid */}
      {loading
        ? <div className="rounded-lg h-96 animate-pulse" style={{ background: 'var(--surface)' }} />
        : (
          <CalendarGrid
            year={year}
            month={month}
            events={events}
            onDayClick={date => setAddModal({ open: true, date })}
            onEventClick={event => setDetailModal({ open: true, event })}
          />
        )
      }

      {/* Legend */}
      <div className="flex items-center gap-5" style={{ fontSize: 11, color: 'var(--muted)' }}>
        {[
          { label: 'Study session', color: 'var(--accent)' },
          { label: 'Exam',          color: '#dc2626' },
          { label: 'Assignment',    color: '#d97706' },
          { label: 'Other',         color: 'var(--muted)' },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 1, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* Modals */}
      {addModal.open && (
        <AddEventModal
          defaultDate={addModal.date}
          onClose={() => setAddModal({ open: false })}
          onCreated={() => { setAddModal({ open: false }); fetchEvents() }}
        />
      )}
      {detailModal.open && detailModal.event && (
        <EventDetailModal
          event={detailModal.event}
          onClose={() => setDetailModal({ open: false })}
          onUpdated={() => { setDetailModal({ open: false }); fetchEvents() }}
          onDeleted={() => { setDetailModal({ open: false }); fetchEvents() }}
        />
      )}
      {importModal && (
        <ImportSyllabusModal
          onClose={() => setImportModal(false)}
          onImported={() => { setImportModal(false); fetchEvents() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add GCal status route** (needed by calendar page)

```ts
// app/api/calendar/gcal/status/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getGcalTokens } from '@/lib/gcal'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokens = await getGcalTokens(session.user.id)
  return NextResponse.json({
    isGoogleUser: tokens !== null,
    hasCalendarScope: tokens?.hasCalendarScope ?? false,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add components/NavTabs.tsx components/calendar/CalendarEvent.tsx components/calendar/CalendarGrid.tsx app/calendar/page.tsx app/api/calendar/gcal/status/
git commit -m "feat: add calendar page, grid, and nav tab"
```

---

## Task 7: Add Event and Event Detail modals

**Files:**
- Create: `components/calendar/AddEventModal.tsx`
- Create: `components/calendar/EventDetailModal.tsx`

- [ ] **Step 1: Create `components/calendar/AddEventModal.tsx`**

```tsx
// components/calendar/AddEventModal.tsx
'use client'

import { useState } from 'react'
import type { EventType } from '@/types/calendar'

interface Props {
  defaultDate?: Date
  onClose: () => void
  onCreated: () => void
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'study',      label: 'Study session' },
  { value: 'exam',       label: 'Exam'          },
  { value: 'assignment', label: 'Assignment'     },
  { value: 'other',      label: 'Other'          },
]

function toInputDate(date: Date) {
  return date.toISOString().split('T')[0]
}

export default function AddEventModal({ defaultDate, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate ? toInputDate(defaultDate) : toInputDate(new Date()))
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  const [type, setType] = useState<EventType>('study')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const isoDate = time ? `${date}T${time}:00Z` : `${date}T00:00:00Z`

    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        date: isoDate,
        duration: duration ? parseInt(duration, 10) : null,
        type,
        notes: notes.trim() || null,
      }),
    })

    if (!res.ok) {
      setError('Failed to create event. Please try again.')
      setSaving(false)
      return
    }
    onCreated()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', animation: 'modal-in 0.15s ease' }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
          >
            Add event
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Exam 1, Study session"
              className="rounded-md px-3 py-2 text-sm w-full"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Time (optional)</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as EventType)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Duration (min)</label>
              <input
                type="number"
                min="5"
                max="480"
                placeholder="e.g. 45"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="rounded-md px-3 py-2 text-sm resize-none"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>

          {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {saving ? 'Saving…' : 'Add event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/calendar/EventDetailModal.tsx`**

```tsx
// components/calendar/EventDetailModal.tsx
'use client'

import { useState } from 'react'
import type { StudyEventData, EventType } from '@/types/calendar'

interface Props {
  event: StudyEventData
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'study',      label: 'Study session' },
  { value: 'exam',       label: 'Exam'          },
  { value: 'assignment', label: 'Assignment'     },
  { value: 'other',      label: 'Other'          },
]

export default function EventDetailModal({ event, onClose, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date.split('T')[0])
  const [time, setTime] = useState(event.date.includes('T') && !event.date.endsWith('T00:00:00.000Z')
    ? event.date.split('T')[1]?.slice(0, 5) ?? ''
    : '')
  const [duration, setDuration] = useState(event.duration?.toString() ?? '')
  const [type, setType] = useState<EventType>(event.type)
  const [notes, setNotes] = useState(event.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    setSaving(true)
    const isoDate = time ? `${date}T${time}:00Z` : `${date}T00:00:00Z`
    await fetch(`/api/calendar/events/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        date: isoDate,
        duration: duration ? parseInt(duration, 10) : null,
        type,
        notes: notes.trim() || null,
      }),
    })
    setSaving(false)
    onUpdated()
  }

  async function handleDelete() {
    await fetch(`/api/calendar/events/${event.id}`, { method: 'DELETE' })
    onDeleted()
  }

  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', animation: 'modal-in 0.15s ease' }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-bold truncate"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
          >
            {editing ? 'Edit event' : event.title}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        {!editing ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{formattedDate}</div>
            {event.duration && (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>{event.duration} minutes</div>
            )}
            <div>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--surface)', color: 'var(--muted)', textTransform: 'capitalize' }}
              >
                {event.type}
              </span>
            </div>
            {event.notes && <p className="text-sm" style={{ color: 'var(--foreground)' }}>{event.notes}</p>}
            {event.gcalEventId && (
              <div className="text-xs" style={{ color: '#4d7c4d' }}>✓ Synced to Google Calendar</div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="rounded-md px-3 py-2 text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={type}
                onChange={e => setType(e.target.value as EventType)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              >
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                type="number"
                placeholder="Duration (min)"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="rounded-md px-3 py-2 text-sm resize-none"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>
        )}

        {confirmDelete ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>Delete this event? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#dc2626', color: '#fff' }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Delete
            </button>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/calendar/AddEventModal.tsx components/calendar/EventDetailModal.tsx
git commit -m "feat: add event creation and detail modals"
```

---

## Task 8: Syllabus import modal

**Files:**
- Create: `components/calendar/ImportSyllabusModal.tsx`

- [ ] **Step 1: Create `components/calendar/ImportSyllabusModal.tsx`**

```tsx
// components/calendar/ImportSyllabusModal.tsx
'use client'

import { useState } from 'react'
import type { CandidateEvent, EventType } from '@/types/calendar'

interface Props {
  onClose: () => void
  onImported: () => void
}

type Step = 'input' | 'review' | 'plan-review'

export default function ImportSyllabusModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [tab, setTab] = useState<'upload' | 'paste'>('upload')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState<CandidateEvent[]>([])
  const [planCandidates, setPlanCandidates] = useState<CandidateEvent[]>([])
  const [error, setError] = useState('')

  async function handleExtract() {
    setExtracting(true)
    setError('')

    let res: Response
    if (tab === 'upload' && file) {
      const fd = new FormData()
      fd.append('file', file)
      res = await fetch('/api/calendar/extract', { method: 'POST', body: fd })
    } else {
      if (!text.trim()) { setError('Please paste some text first.'); setExtracting(false); return }
      res = await fetch('/api/calendar/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    }

    if (!res.ok) { setError('Extraction failed. Please try again.'); setExtracting(false); return }
    const data: CandidateEvent[] = await res.json()
    if (data.length === 0) { setError('No dates found. Try pasting more text.'); setExtracting(false); return }
    setCandidates(data)
    setStep('review')
    setExtracting(false)
  }

  function removeCandidate(i: number) {
    setCandidates(c => c.filter((_, idx) => idx !== i))
  }

  function updateCandidateTitle(i: number, title: string) {
    setCandidates(c => c.map((ev, idx) => idx === i ? { ...ev, title } : ev))
  }

  function updateCandidateDate(i: number, date: string) {
    setCandidates(c => c.map((ev, idx) => idx === i ? { ...ev, date } : ev))
  }

  function updateCandidateType(i: number, type: CandidateEvent['type']) {
    setCandidates(c => c.map((ev, idx) => idx === i ? { ...ev, type } : ev))
  }

  async function handleGeneratePlan() {
    setGenerating(true)
    setError('')
    const res = await fetch('/api/calendar/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: candidates }),
    })
    if (!res.ok) { setError('Plan generation failed.'); setGenerating(false); return }
    const sessions: CandidateEvent[] = await res.json()
    setPlanCandidates(sessions)
    setStep('plan-review')
    setGenerating(false)
  }

  function removePlanCandidate(i: number) {
    setPlanCandidates(p => p.filter((_, idx) => idx !== i))
  }

  async function handleSave(includePlan: boolean) {
    setSaving(true)
    const allEvents = includePlan ? [...candidates, ...planCandidates] : candidates
    const payload = allEvents.map(e => ({
      title: e.title,
      date: e.date.includes('T') ? e.date : `${e.date}T00:00:00Z`,
      duration: e.duration ?? null,
      type: e.type as EventType,
    }))
    const res = await fetch('/api/calendar/events/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) { setError('Failed to save events.'); setSaving(false); return }
    onImported()
  }

  const TYPE_OPTS: CandidateEvent['type'][] = ['exam', 'assignment', 'other']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-xl flex flex-col"
        style={{ background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', animation: 'modal-in 0.15s ease', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}>
              {step === 'input' ? 'Import syllabus' : step === 'review' ? 'Review extracted events' : 'Review study plan'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {step === 'input'
                ? 'AI will extract dates and deadlines automatically'
                : step === 'review'
                ? 'Edit or remove events before adding to calendar'
                : 'Review generated study sessions'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto flex-1">

          {step === 'input' && (
            <>
              {/* Tab row */}
              <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: '1px solid var(--border)' }}>
                {(['upload', 'paste'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-1.5 font-medium"
                    style={{
                      background: tab === t ? 'var(--accent)' : 'var(--background)',
                      color: tab === t ? '#fff' : 'var(--muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'upload' ? 'Upload file' : 'Paste text'}
                  </button>
                ))}
              </div>

              {tab === 'upload' ? (
                <label
                  className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                  style={{ border: '1px dashed var(--border-hover)', padding: '32px 16px', textAlign: 'center' }}
                >
                  <span style={{ fontSize: 24 }}>📄</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {file ? file.name : 'Drop your syllabus here or click to browse'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--border-hover)' }}>PDF or TXT · up to 10 MB</span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.text"
                    className="sr-only"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : (
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste your syllabus text here..."
                  rows={8}
                  className="rounded-lg px-3 py-2 text-sm resize-none"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                />
              )}

              {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
            </>
          )}

          {step === 'review' && (
            <div className="flex flex-col gap-2">
              {candidates.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <select
                    value={ev.type}
                    onChange={e => updateCandidateType(i, e.target.value as CandidateEvent['type'])}
                    className="text-xs rounded px-1 py-0.5"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  >
                    {TYPE_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    value={ev.title}
                    onChange={e => updateCandidateTitle(i, e.target.value)}
                    className="flex-1 text-sm rounded px-2 py-0.5 min-w-0"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  />
                  <input
                    type="date"
                    value={ev.date.split('T')[0]}
                    onChange={e => updateCandidateDate(i, e.target.value)}
                    className="text-xs rounded px-2 py-0.5"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={() => removeCandidate(i)}
                    className="text-xs px-1"
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {candidates.length === 0 && (
                <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>No events remaining.</p>
              )}
              {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
            </div>
          )}

          {step === 'plan-review' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {planCandidates.length} study sessions generated. Remove any you don't want.
              </p>
              {planCandidates.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface)', color: 'var(--muted)', flexShrink: 0 }}
                  >
                    study
                  </span>
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--foreground)' }}>{ev.title}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                    {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {ev.duration ? ` · ${ev.duration}m` : ''}
                  </span>
                  <button
                    onClick={() => removePlanCandidate(i)}
                    className="text-xs px-1"
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {step === 'input' && (
            <>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Supports PDF and plain text</span>
              <button
                onClick={handleExtract}
                disabled={extracting || (tab === 'upload' && !file) || (tab === 'paste' && !text.trim())}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {extracting ? 'Extracting…' : 'Extract dates with AI →'}
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {candidates.length} event{candidates.length !== 1 ? 's' : ''} found
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || candidates.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                >
                  {saving ? 'Saving…' : 'Add to calendar'}
                </button>
                <button
                  onClick={handleGeneratePlan}
                  disabled={generating || candidates.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {generating ? 'Generating…' : 'Generate study plan →'}
                </button>
              </div>
            </>
          )}

          {step === 'plan-review' && (
            <>
              <button
                onClick={() => setStep('review')}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
              >
                ← Back
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {saving ? 'Saving…' : `Add all ${candidates.length + planCandidates.length} events →`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/ImportSyllabusModal.tsx
git commit -m "feat: add syllabus import modal with AI extraction and study plan generation"
```

---

## Task 9: Dashboard widget + dashboard integration

**Files:**
- Create: `components/calendar/ThisWeekWidget.tsx`
- Create: `__tests__/components/ThisWeekWidget.test.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Write failing tests for ThisWeekWidget**

Create `__tests__/components/ThisWeekWidget.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import ThisWeekWidget from '@/components/calendar/ThisWeekWidget'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

global.fetch = jest.fn()

beforeEach(() => jest.clearAllMocks())

describe('ThisWeekWidget', () => {
  it('shows loading state initially', () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })
    render(<ThisWeekWidget />)
    // While loading, no events text should be shown
    expect(screen.queryByText(/nothing scheduled/i)).not.toBeInTheDocument()
  })

  it('shows empty state when no events', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })
    render(<ThisWeekWidget />)
    await waitFor(() => {
      expect(screen.getByText(/nothing scheduled/i)).toBeInTheDocument()
    })
  })

  it('renders events when present', async () => {
    const mockEvent = {
      id: 'ev-1',
      title: 'Exam 1',
      date: new Date().toISOString(),
      duration: null,
      type: 'exam',
      guideId: null,
      gcalEventId: null,
      notes: null,
      createdAt: new Date().toISOString(),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [mockEvent] })
    render(<ThisWeekWidget />)
    await waitFor(() => {
      expect(screen.getByText('Exam 1')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/components/ThisWeekWidget.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/calendar/ThisWeekWidget.tsx`**

```tsx
// components/calendar/ThisWeekWidget.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CalendarEvent from './CalendarEvent'
import type { StudyEventData } from '@/types/calendar'

export default function ThisWeekWidget() {
  const [events, setEvents] = useState<StudyEventData[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const now = new Date()
    // Monday of this week
    const day = now.getDay() // 0=Sun
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    // Sunday of this week
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    fetch(`/api/calendar/events?from=${monday.toISOString()}&to=${sunday.toISOString()}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: StudyEventData[]) => {
        setEvents(data)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          This Week
        </span>
        <Link href="/calendar" className="text-xs" style={{ color: 'var(--muted)' }}>
          View calendar →
        </Link>
      </div>

      {/* Events */}
      <div className="flex flex-col">
        {!loaded && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2].map(i => (
              <div
                key={i}
                className="h-8 rounded"
                style={{ background: 'var(--surface)', animation: 'loading-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}

        {loaded && events.length === 0 && (
          <div className="px-4 py-5 text-center">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Nothing scheduled this week.</p>
            <Link href="/calendar" className="text-xs font-semibold mt-1 inline-block" style={{ color: 'var(--accent)' }}>
              Add events →
            </Link>
          </div>
        )}

        {loaded && events.map((ev, i) => (
          <div
            key={ev.id}
            className="px-4 py-2.5"
            style={{ borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            <CalendarEvent event={ev} variant="row" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run ThisWeekWidget tests**

```bash
npx jest --no-coverage __tests__/components/ThisWeekWidget.test.tsx
```

Expected: all pass.

- [ ] **Step 5: Update `app/dashboard/page.tsx`**

At the top of the file, add the import:

```ts
import ThisWeekWidget from '@/components/calendar/ThisWeekWidget'
```

In the stats row, change the array from 2 items to 3. Find the `[{ label: 'Guides', ... }, { label: 'Groups', ... }]` array and replace it with:

```ts
[
  { label: 'Guides', value: loaded ? guides.length : '—', href: '/guides' },
  { label: 'Groups', value: loaded ? groups.length : '—', href: '/groups' },
  { label: 'This Week', value: '—', href: '/calendar' },
]
```

Change the grid from `grid-cols-2` to `grid-cols-3`:

```tsx
className="grid grid-cols-3 gap-px mb-10 rounded-lg overflow-hidden"
```

In the right column, add `<ThisWeekWidget />` above the Quick Generate section. Find the comment `{/* Quick generate */}` and add above it:

```tsx
{/* This week */}
<ThisWeekWidget />
```

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add components/calendar/ThisWeekWidget.tsx app/dashboard/page.tsx __tests__/components/ThisWeekWidget.test.tsx
git commit -m "feat: add This Week dashboard widget and calendar stat tile"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - StudyEvent model ✓ (Task 1)
  - Shared types ✓ (Task 2)
  - Events CRUD API ✓ (Task 3)
  - Google Calendar lib + OAuth connect/callback ✓ (Task 4)
  - GCal sync route ✓ (Task 4)
  - GCal status route ✓ (Task 6, step 5)
  - AI extraction ✓ (Task 5)
  - Study plan generation ✓ (Task 5)
  - NavTabs Calendar link ✓ (Task 6)
  - Calendar page with grid ✓ (Task 6)
  - GCal connect banner on calendar page ✓ (Task 6)
  - Add event modal ✓ (Task 7)
  - Event detail/edit/delete modal ✓ (Task 7)
  - Syllabus import modal with two-step flow ✓ (Task 8)
  - Dashboard widget ✓ (Task 9)
  - Dashboard stats tile ✓ (Task 9)
  - Theming consistent with app ✓ (all components use CSS custom properties)
- [x] **No placeholders** — all steps have concrete code
- [x] **Type consistency** — `StudyEventData`, `CandidateEvent`, `EventType`, `CreateEventPayload` defined once in `types/calendar.ts` and imported throughout
- [x] **Token refresh** — handled in `getGcalTokens` in `lib/gcal.ts`
- [x] **Batch create** — `POST /api/calendar/events/batch` covers import flow's need to create multiple events at once
