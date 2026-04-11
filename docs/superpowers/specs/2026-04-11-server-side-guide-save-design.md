# Server-Side Guide Save

**Date:** 2026-04-11

## Problem

Guide generation is streamed from the server via SSE. The guide is currently saved to the database client-side: the browser receives the `done` event, then POSTs to `/api/guides`. If the user navigates away before the stream completes, the SSE connection drops and the save never happens — the guide is lost.

## Solution

Move the DB save into the generate route on the server. The guide is persisted before the `done` event is sent, so navigation or tab closure after that point cannot lose it.

## Changes

### `app/api/guides/generate/route.ts`

After `assignIds()` constructs the `guide` object:

1. Call `prisma.guide.create()` with `id`, `userId` (from `session.user.id`), `title`, `mode`, `content` (sections), and optional `projectId`.
2. If the DB write fails, send an `error` SSE event and close the stream (same pattern as other error handling in this route).
3. Send `{ type: 'done', guideId: guide.id }` — the full guide object is no longer needed by the client.

### `GenerateEvent` type

Change the `done` variant:

```ts
// Before
| { type: 'done'; guide: Guide }

// After
| { type: 'done'; guideId: string }
```

### `app/generate/page.tsx`

On receiving the `done` event:

1. Remove the `POST /api/guides` fetch.
2. Call `clearPending()`.
3. Navigate to `/guide/${event.guideId}`.

## What Does Not Change

- `POST /api/guides` route — left intact for any other callers.
- All SSE stage events and error handling — unchanged.
- Client-side progress UI — unchanged.

## Error Handling

If `prisma.guide.create()` throws, the route sends `{ type: 'error', message }` and closes the stream. The client shows the existing retry UI.

## Testing

Existing generate page tests that mock the SSE stream need to be updated: the `done` event payload changes from `{ guide: Guide }` to `{ guideId: string }`, and the mock should no longer expect a subsequent `POST /api/guides` fetch.
