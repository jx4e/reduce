# Server-Side Guide Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move guide DB save from client-side to server-side so guides are persisted even if the user navigates away from the waiting screen.

**Architecture:** The generate SSE route (`/api/guides/generate`) currently streams the full `Guide` object to the client, which then POSTs it to `/api/guides`. Instead, the route will call `prisma.guide.create()` itself before emitting the `done` event, and the client will receive only a `guideId` for navigation.

**Tech Stack:** Next.js App Router, Prisma, Server-Sent Events, Jest + React Testing Library

---

## File Map

| File | Change |
|---|---|
| `app/api/guides/generate/route.ts` | Add `prisma.guide.create()`; change `done` event payload |
| `app/generate/page.tsx` | Remove `POST /api/guides` fetch; use `guideId` from event |
| `__tests__/GeneratePage.test.tsx` | Update `done` event fixture; remove second fetch mock |

---

### Task 1: Update the generate page test for the new `done` shape

The test currently mocks a `done` event with a full `guide` object and a second `fetch` mock for the save POST. After this change, `done` carries only `guideId` and there is no second fetch.

**Files:**
- Modify: `__tests__/GeneratePage.test.tsx:95-120`

- [ ] **Step 1: Update the `done` test to use the new event shape**

In `__tests__/GeneratePage.test.tsx`, replace the test `'shows Done! and navigates after 600ms on success'`:

```tsx
it('shows Done! and navigates after 600ms on success', async () => {
  jest.useFakeTimers()
  global.fetch = jest.fn().mockResolvedValueOnce(
    makeStream({ type: 'done', guideId: 'guide-abc' })
  )

  render(<GeneratePage />)

  await waitFor(() => expect(screen.getByText('Done!')).toBeInTheDocument())

  expect(mockPush).not.toHaveBeenCalled()

  act(() => { jest.advanceTimersByTime(600) })
  expect(mockPush).toHaveBeenCalledWith('/guide/guide-abc')
  expect(mockClearPending).toHaveBeenCalled()

  jest.useRealTimers()
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx jest --no-coverage __tests__/GeneratePage.test.tsx -t "shows Done"
```

Expected: FAIL — the page still expects `event.guide` and makes a second fetch.

---

### Task 2: Update the `GenerateEvent` type and save guide in the route

**Files:**
- Modify: `app/api/guides/generate/route.ts`

- [ ] **Step 1: Change the `done` variant of `GenerateEvent`**

In `app/api/guides/generate/route.ts`, replace:

```ts
export type GenerateEvent =
  | { type: 'stage'; stage: 'parsing' | 'analyzing' | 'writing' | 'rendering' }
  | { type: 'done'; guide: Guide }
  | { type: 'error'; message: string }
```

with:

```ts
export type GenerateEvent =
  | { type: 'stage'; stage: 'parsing' | 'analyzing' | 'writing' | 'rendering' }
  | { type: 'done'; guideId: string }
  | { type: 'error'; message: string }
```

- [ ] **Step 2: Add the DB save and update the `done` emit**

In the same file, find the block after `assignIds` (around line 264–275). Replace:

```ts
let guide: Guide
try {
  guide = assignIds(parsed, mode)
  if (customTitle) guide = { ...guide, title: customTitle }
} catch {
  send(controller, { type: 'error', message: 'Failed to process Claude response' })
  controller.close()
  return
}

log.info({ id: guide.id, title: guide.title, sections: guide.sections.length }, 'guide generated')
send(controller, { type: 'done', guide })
controller.close()
```

with:

```ts
let guide: Guide
try {
  guide = assignIds(parsed, mode)
  if (customTitle) guide = { ...guide, title: customTitle }
} catch {
  send(controller, { type: 'error', message: 'Failed to process Claude response' })
  controller.close()
  return
}

try {
  await prisma.guide.create({
    data: {
      id: guide.id,
      userId: session.user!.id,
      title: guide.title,
      mode: guide.mode,
      content: guide.sections,
      ...(projectId ? { projectId } : {}),
    },
  })
} catch (err) {
  const message = err instanceof Error ? err.message : 'Failed to save guide'
  log.error({ err }, 'failed to save guide to database')
  send(controller, { type: 'error', message })
  controller.close()
  return
}

log.info({ id: guide.id, title: guide.title, sections: guide.sections.length }, 'guide saved')
send(controller, { type: 'done', guideId: guide.id })
controller.close()
```

- [ ] **Step 3: Commit**

```bash
git add app/api/guides/generate/route.ts
git commit -m "feat: save guide server-side in generate route"
```

---

### Task 3: Update the generate page to use `guideId`

**Files:**
- Modify: `app/generate/page.tsx:95-110`

- [ ] **Step 1: Remove the save fetch and update navigation**

In `app/generate/page.tsx`, replace the `done` handler block:

```ts
} else if (event.type === 'done') {
  setProgress(100)
  setIsDone(true)

  const saveRes = await fetch('/api/guides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...event.guide,
      projectId: peekPending()?.projectId,
    }),
  })
  if (!saveRes.ok) throw new Error('Failed to save guide')

  clearPending()
  navTimeoutRef.current = setTimeout(() => router.push(`/guide/${event.guide.id}`), 600)
  return
```

with:

```ts
} else if (event.type === 'done') {
  setProgress(100)
  setIsDone(true)
  clearPending()
  navTimeoutRef.current = setTimeout(() => router.push(`/guide/${event.guideId}`), 600)
  return
```

- [ ] **Step 2: Run all generate page tests**

```bash
npx jest --no-coverage __tests__/GeneratePage.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/generate/page.tsx __tests__/GeneratePage.test.tsx
git commit -m "feat: remove client-side guide save, navigate using guideId from SSE"
```
