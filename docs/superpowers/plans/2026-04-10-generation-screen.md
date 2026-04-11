# Generation Screen Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the numbered stepper on `/generate` with a progress bar + stage copy layout that feels alive, shows the Rendering step visibly before navigating, and gives a useful error state with retry.

**Architecture:** `lib/pendingGeneration.ts` gains two new exports — `peekPending` (read without clearing) and `clearPending` (explicit clear) — so the generate page can retry without losing the pending data. `app/generate/page.tsx` is rewritten to use an eased fake-progress bar driven by stage events, a 600ms completion hold before navigation, and an error state with Retry + Start over actions.

**Tech Stack:** Next.js App Router (client component), React hooks, Tailwind CSS v4, Jest + React Testing Library

---

## File Map

| File | Action | What changes |
|---|---|---|
| `lib/pendingGeneration.ts` | Modify | Add `peekPending()` and `clearPending()` exports |
| `app/generate/page.tsx` | Rewrite | Progress bar UI, stage copy, eased progress, done hold, retry logic |
| `__tests__/pendingGeneration.test.ts` | Create | Tests for new peek/clear functions |
| `__tests__/GeneratePage.test.tsx` | Create | Tests for new generate page behaviour |

---

## Task 1: Update `pendingGeneration.ts` — add peek/clear

**Files:**
- Modify: `lib/pendingGeneration.ts`
- Create: `__tests__/pendingGeneration.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/pendingGeneration.test.ts`:

```ts
import { setPending, peekPending, clearPending, consumePending } from '@/lib/pendingGeneration'

describe('pendingGeneration', () => {
  afterEach(() => {
    clearPending()
  })

  it('peekPending returns data without clearing it', () => {
    const data = { files: [] as File[], mode: 'math-cs' as const }
    setPending(data)
    expect(peekPending()).toEqual(data)
    expect(peekPending()).toEqual(data) // still present after second peek
  })

  it('clearPending removes the pending data', () => {
    setPending({ files: [] as File[], mode: 'math-cs' })
    clearPending()
    expect(peekPending()).toBeNull()
  })

  it('peekPending returns null when nothing is set', () => {
    expect(peekPending()).toBeNull()
  })

  it('consumePending still reads and clears (existing behaviour unchanged)', () => {
    const data = { files: [] as File[], mode: 'humanities' as const }
    setPending(data)
    expect(consumePending()).toEqual(data)
    expect(peekPending()).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx jest __tests__/pendingGeneration.test.ts --no-coverage
```

Expected: FAIL — `peekPending` and `clearPending` are not exported.

- [ ] **Step 3: Add peekPending and clearPending to the module**

Replace the contents of `lib/pendingGeneration.ts`:

```ts
import type { GuideMode } from '@/types/guide'

interface PendingGeneration {
  files: File[]
  mode: GuideMode
}

let pending: PendingGeneration | null = null

export function setPending(data: PendingGeneration): void {
  pending = data
}

/** Read pending data without clearing it. */
export function peekPending(): PendingGeneration | null {
  return pending
}

/** Explicitly clear pending data (call on success or user dismissal). */
export function clearPending(): void {
  pending = null
}

/** Legacy: read and immediately clear. Kept for any existing callers. */
export function consumePending(): PendingGeneration | null {
  const p = pending
  pending = null
  return p
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/pendingGeneration.test.ts --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/pendingGeneration.ts __tests__/pendingGeneration.test.ts
git commit -m "feat: add peekPending and clearPending to pendingGeneration"
```

---

## Task 2: Rewrite generate page

**Files:**
- Rewrite: `app/generate/page.tsx`
- Create: `__tests__/GeneratePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/GeneratePage.test.tsx`:

```tsx
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import GeneratePage from '@/app/generate/page'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

const mockPeekPending = jest.fn()
const mockClearPending = jest.fn()

jest.mock('@/lib/pendingGeneration', () => ({
  peekPending: () => mockPeekPending(),
  clearPending: () => mockClearPending(),
}))

/** Build a minimal fake SSE stream from an array of GenerateEvent objects. */
function makeStream(...events: object[]) {
  const text = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
  let consumed = false
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (consumed) return { done: true as const, value: undefined }
          consumed = true
          return { done: false as const, value: new TextEncoder().encode(text) }
        },
      }),
    },
  }
}

const PENDING = {
  files: [new File(['x'], 'test.pdf', { type: 'application/pdf' })],
  mode: 'math-cs' as const,
}

describe('GeneratePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPeekPending.mockReturnValue(PENDING)
  })

  // --- Loading state ---

  it('shows the initial stage title', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) // never resolves
    render(<GeneratePage />)
    expect(screen.getByText('Reading your files…')).toBeInTheDocument()
  })

  it('shows the initial stage description', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<GeneratePage />)
    expect(screen.getByText('Extracting text and structure from your uploads')).toBeInTheDocument()
  })

  it('renders the progress bar element', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<GeneratePage />)
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
  })

  it('shows the stage counter', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<GeneratePage />)
    expect(screen.getByText('Stage 1 of 4')).toBeInTheDocument()
  })

  it('redirects to home when there is no pending data', async () => {
    mockPeekPending.mockReturnValue(null)
    global.fetch = jest.fn()
    render(<GeneratePage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  })

  it('advances stage title when a stage event arrives', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream(
        { type: 'stage', stage: 'analyzing' },
        // never sends done, so we can observe the interim state
      )
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByText('Analyzing your material…')).toBeInTheDocument()
    )
  })

  // --- Done state ---

  it('shows Done! and navigates after 600ms on success', async () => {
    jest.useFakeTimers()
    const guide = {
      id: 'guide-abc',
      title: 'Test Guide',
      sections: [],
      mode: 'math-cs',
      createdAt: 'Apr 10, 2026',
    }
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream({ type: 'done', guide }))
      .mockResolvedValueOnce({ ok: true }) // save guide POST

    render(<GeneratePage />)

    await waitFor(() => expect(screen.getByText('Done!')).toBeInTheDocument())

    // Should NOT have navigated yet
    expect(mockPush).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(600) })
    expect(mockPush).toHaveBeenCalledWith('/guide/guide-abc')
    expect(mockClearPending).toHaveBeenCalled()

    jest.useRealTimers()
  })

  // --- Error state ---

  it('shows error heading when generation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'AI service unavailable' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByText('Generation failed')).toBeInTheDocument()
    )
  })

  it('shows the error message text', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'AI service unavailable' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByText('AI service unavailable')).toBeInTheDocument()
    )
  })

  it('shows a Retry button in the error state', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'Oops' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    )
  })

  it('shows a Start over link in the error state', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'Oops' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /start over/i })).toBeInTheDocument()
    )
  })

  it('clicking Retry re-runs generation', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream({ type: 'error', message: 'Failed' }))
      .mockReturnValueOnce(new Promise(() => {})) // second attempt hangs

    render(<GeneratePage />)
    await waitFor(() => screen.getByRole('button', { name: /retry/i }))

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('clicking Retry clears the error state', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream({ type: 'error', message: 'Failed' }))
      .mockReturnValueOnce(new Promise(() => {}))

    render(<GeneratePage />)
    await waitFor(() => screen.getByRole('button', { name: /retry/i }))

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.queryByText('Generation failed')).not.toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx jest __tests__/GeneratePage.test.tsx --no-coverage
```

Expected: FAIL — the existing page has no `progress-bar` testid, uses `consumePending`, and lacks the new stage copy.

- [ ] **Step 3: Rewrite app/generate/page.tsx**

Replace the entire file:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { peekPending, clearPending } from '@/lib/pendingGeneration'
import type { GenerateEvent } from '@/app/api/guides/generate/route'

const STAGES = [
  {
    title: 'Reading your files…',
    description: 'Extracting text and structure from your uploads',
  },
  {
    title: 'Analyzing your material…',
    description: 'Breaking down structure and key concepts',
  },
  {
    title: 'Writing your guide…',
    description: 'Generating sections, examples, and explanations',
  },
  {
    title: 'Finishing up…',
    description: 'Assembling the final guide',
  },
]

const STAGE_INDEX: Record<string, number> = {
  parsing: 0,
  analyzing: 1,
  writing: 2,
  rendering: 3,
}

// Progress bar settles here while each stage is active (just below next band start)
const STAGE_SETTLE = [18, 47, 82, 97]

export default function GeneratePage() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const runGeneration = useCallback(async () => {
    setError(null)
    setCurrentStage(0)
    setProgress(0)
    setIsDone(false)

    const pending = peekPending()
    if (!pending) {
      router.replace('/')
      return
    }

    try {
      const formData = new FormData()
      pending.files.forEach(f => formData.append('files', f))
      formData.append('mode', pending.mode)

      const res = await fetch('/api/guides/generate', { method: 'POST', body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(body.error ?? 'Generation failed')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event: GenerateEvent = JSON.parse(line.slice(6))

          if (event.type === 'stage') {
            const idx = STAGE_INDEX[event.stage] ?? 0
            setCurrentStage(idx)
            setProgress(STAGE_SETTLE[idx])
          } else if (event.type === 'done') {
            setProgress(100)
            setIsDone(true)

            const saveRes = await fetch('/api/guides', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(event.guide),
            })
            if (!saveRes.ok) throw new Error('Failed to save guide')

            clearPending()
            setTimeout(() => router.push(`/guide/${event.guide.id}`), 600)
            return
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [router])

  useEffect(() => {
    if (started.current) return
    started.current = true
    runGeneration()
  }, [runGeneration])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Generation failed
        </p>
        <p className="text-xs max-w-sm" style={{ color: 'var(--muted)' }}>
          {error}
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={runGeneration}
            className="rounded-full px-5 py-2 text-xs font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Retry
          </button>
          <Link
            href="/app"
            onClick={clearPending}
            className="text-xs font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            ← Start over
          </Link>
        </div>
      </div>
    )
  }

  const title = isDone ? 'Done!' : STAGES[currentStage].title
  const description = isDone
    ? 'Redirecting you to your guide…'
    : STAGES[currentStage].description

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div
          className="h-[3px] rounded-full overflow-hidden"
          style={{ background: 'var(--border)' }}
        >
          <div
            data-testid="progress-bar"
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--accent), #a78bfa)',
              transition: 'width 1.5s ease-out',
            }}
          />
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Stage {currentStage + 1} of {STAGES.length}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/GeneratePage.test.tsx --no-coverage
```

Expected: PASS — all 13 tests.

- [ ] **Step 5: Run the full test suite to catch regressions**

```bash
npx jest --no-coverage
```

Expected: All tests pass. If `AppPage.test.tsx` or others fail because they mock `consumePending` — check their mocks include the new exports (the mocks are module-level overrides so adding new exports won't break them, but verify).

- [ ] **Step 6: Commit**

```bash
git add app/generate/page.tsx __tests__/GeneratePage.test.tsx
git commit -m "feat: replace stepper with progress bar on generate screen"
```
