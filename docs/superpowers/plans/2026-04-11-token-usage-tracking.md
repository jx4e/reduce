# Token Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track each user's Claude API token consumption and display lifetime totals with estimated dollar cost on the dashboard.

**Architecture:** Add a `TokenUsage` event table to Postgres (one row per Claude API call), insert rows after each successful generate/chat call, expose a `GET /api/usage` endpoint that aggregates totals and computes cost, and extend the dashboard stats row with Tokens and Est. Cost cards.

**Tech Stack:** Prisma, PostgreSQL, Next.js App Router, React 19, Jest + Testing Library

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `TokenUsage` model and `User.tokenUsage` relation |
| `lib/tokenCost.ts` | Create | Pure cost calculation — `computeCostUsd(input, output)` |
| `app/api/usage/route.ts` | Create | `GET /api/usage` — aggregate query + cost response |
| `app/api/guides/generate/route.ts` | Modify | Insert `TokenUsage` row after generation succeeds |
| `app/api/guides/[id]/chat/route.ts` | Modify | Add session lookup; insert `TokenUsage` row after chat |
| `app/dashboard/page.tsx` | Modify | Fetch `/api/usage`; expand stats grid to 4 cards |
| `__tests__/tokenCost.test.ts` | Create | Unit tests for cost calculation |
| `__tests__/DashboardPage.test.tsx` | Create | Component tests for token/cost stat cards |

---

### Task 1: Add TokenUsage schema and run migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the TokenUsage model and User relation to schema**

In `prisma/schema.prisma`, add to the `User` model:

```prisma
model User {
  id            String       @id @default(cuid())
  name          String?
  email         String       @unique
  emailVerified DateTime?
  image         String?
  password      String?
  accounts      Account[]
  sessions      Session[]
  guides        Guide[]
  projects      Project[]
  tokenUsage    TokenUsage[]
  createdAt     DateTime     @default(now())
}
```

Then append at the end of the file:

```prisma
model TokenUsage {
  id           String   @id @default(cuid())
  userId       String
  operation    String
  inputTokens  Int
  outputTokens Int
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_token_usage
```

Expected output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add TokenUsage model"
```

---

### Task 2: Cost calculation utility

**Files:**
- Create: `lib/tokenCost.ts`
- Create: `__tests__/tokenCost.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/tokenCost.test.ts`:

```typescript
import { computeCostUsd } from '@/lib/tokenCost'

describe('computeCostUsd', () => {
  it('returns 0 for zero tokens', () => {
    expect(computeCostUsd(0, 0)).toBe(0)
  })

  it('calculates input token cost at $3 per million', () => {
    expect(computeCostUsd(1_000_000, 0)).toBeCloseTo(3.0, 6)
  })

  it('calculates output token cost at $15 per million', () => {
    expect(computeCostUsd(0, 1_000_000)).toBeCloseTo(15.0, 6)
  })

  it('combines input and output costs', () => {
    // 500k input ($1.50) + 100k output ($1.50) = $3.00
    expect(computeCostUsd(500_000, 100_000)).toBeCloseTo(3.0, 6)
  })

  it('handles small token counts precisely', () => {
    // 1000 input ($0.003) + 500 output ($0.0075) = $0.0105
    expect(computeCostUsd(1000, 500)).toBeCloseTo(0.0105, 6)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest --no-coverage __tests__/tokenCost.test.ts
```

Expected: FAIL with `Cannot find module '@/lib/tokenCost'`

- [ ] **Step 3: Implement the utility**

Create `lib/tokenCost.ts`:

```typescript
const INPUT_COST_PER_M = 3.0   // $3.00 per million input tokens (claude-sonnet-4-6)
const OUTPUT_COST_PER_M = 15.0 // $15.00 per million output tokens (claude-sonnet-4-6)

export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_M + outputTokens * OUTPUT_COST_PER_M) / 1_000_000
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/tokenCost.test.ts
```

Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/tokenCost.ts __tests__/tokenCost.test.ts
git commit -m "feat: add token cost calculation utility"
```

---

### Task 3: Usage API endpoint

**Files:**
- Create: `app/api/usage/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/usage/route.ts`:

```typescript
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { computeCostUsd } from '@/lib/tokenCost'

export async function GET(): Promise<Response> {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const result = await prisma.tokenUsage.aggregate({
    where: { userId: session.user.id },
    _sum: { inputTokens: true, outputTokens: true },
  })

  const inputTokens = result._sum.inputTokens ?? 0
  const outputTokens = result._sum.outputTokens ?? 0

  return Response.json({
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: computeCostUsd(inputTokens, outputTokens),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/route.ts
git commit -m "feat: add GET /api/usage endpoint"
```

---

### Task 4: Record usage in guide generation

**Files:**
- Modify: `app/api/guides/generate/route.ts`

The existing code at line 213 already captures `finalMessage`. We add a fire-and-forget insert immediately after the existing `log.info` call (around line 214–218).

- [ ] **Step 1: Add the token usage insert**

In `app/api/guides/generate/route.ts`, find this block (around line 213):

```typescript
          const finalMessage = await claudeStream.finalMessage()
          log.info({
            stop_reason: finalMessage.stop_reason,
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
          }, 'Claude finished')
```

Replace with:

```typescript
          const finalMessage = await claudeStream.finalMessage()
          log.info({
            stop_reason: finalMessage.stop_reason,
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
          }, 'Claude finished')

          prisma.tokenUsage.create({
            data: {
              userId: session.user!.id,
              operation: 'generate',
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
            },
          }).catch(err => log.warn({ err }, 'failed to record token usage'))
```

- [ ] **Step 2: Commit**

```bash
git add app/api/guides/generate/route.ts
git commit -m "feat: record token usage after guide generation"
```

---

### Task 5: Record usage in chat

**Files:**
- Modify: `app/api/guides/[id]/chat/route.ts`

The chat route currently has no auth check. We add a session lookup (not enforced — missing session just skips the insert), then record usage after the chat completes.

- [ ] **Step 1: Add auth import and session lookup**

In `app/api/guides/[id]/chat/route.ts`, the current imports are:

```typescript
import type { NextRequest } from 'next/server'
import { getClient } from '@/lib/anthropic'
import logger from '@/lib/logger'
```

Replace with:

```typescript
import type { NextRequest } from 'next/server'
import { getClient } from '@/lib/anthropic'
import logger from '@/lib/logger'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
```

- [ ] **Step 2: Add session lookup inside the POST handler**

Find the start of the `POST` function body (after the `{ id }` params destructure and the log statement). Add session lookup right after the `log` declaration:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const log = logger.child({ route: 'POST /api/guides/[id]/chat', guideId: id })
  const session = await auth()
```

- [ ] **Step 3: Add token usage insert after `finalMessage`**

Find this block inside the stream's `start` function (around line 88):

```typescript
        const final = await claudeStream.finalMessage()
        log.info({
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          stop_reason: final.stop_reason,
        }, 'chat response done')

        send(controller, { type: 'done' })
```

Replace with:

```typescript
        const final = await claudeStream.finalMessage()
        log.info({
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          stop_reason: final.stop_reason,
        }, 'chat response done')

        if (session?.user?.id) {
          prisma.tokenUsage.create({
            data: {
              userId: session.user.id,
              operation: 'chat',
              inputTokens: final.usage.input_tokens,
              outputTokens: final.usage.output_tokens,
            },
          }).catch(err => log.warn({ err }, 'failed to record token usage'))
        }

        send(controller, { type: 'done' })
```

- [ ] **Step 4: Commit**

```bash
git add app/api/guides/[id]/chat/route.ts
git commit -m "feat: record token usage after chat"
```

---

### Task 6: Dashboard display

**Files:**
- Modify: `app/dashboard/page.tsx`
- Create: `__tests__/DashboardPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/DashboardPage.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/pendingGeneration', () => ({
  setPending: jest.fn(),
}))

function mockFetch(usagePayload: { totalTokens: number; estimatedCostUsd: number } | null) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url === '/api/guides') return Promise.resolve({ json: async () => [] })
    if (url === '/api/projects') return Promise.resolve({ json: async () => [] })
    if (url === '/api/usage') {
      if (usagePayload === null) return Promise.reject(new Error('network error'))
      return Promise.resolve({ json: async () => usagePayload })
    }
    return Promise.resolve({ json: async () => ({}) })
  })
}

describe('DashboardPage usage stats', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders Tokens label', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Tokens')).toBeInTheDocument())
  })

  it('renders formatted token count', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('42,000')).toBeInTheDocument())
  })

  it('renders Est. Cost label', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Est. Cost')).toBeInTheDocument())
  })

  it('renders formatted cost', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('$0.0042')).toBeInTheDocument())
  })

  it('shows — for tokens when usage fetch fails', async () => {
    mockFetch(null)
    render(<DashboardPage />)
    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows $0.00 for cost when usage fetch fails', async () => {
    mockFetch(null)
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('$0.00')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest --no-coverage __tests__/DashboardPage.test.tsx
```

Expected: FAIL — `Cannot find module` or rendering assertions failing because the stats don't exist yet.

- [ ] **Step 3: Update DashboardPage**

Replace the entire contents of `app/dashboard/page.tsx` with:

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import GuideCard from '@/components/GuideCard'
import UploadZone from '@/components/UploadZone'
import type { GuideCardData, GuideMode } from '@/types/guide'
import type { ProjectCardData } from '@/types/project'
import { setPending } from '@/lib/pendingGeneration'

interface UsageData {
  totalTokens: number
  estimatedCostUsd: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [guides, setGuides] = useState<GuideCardData[]>([])
  const [groups, setGroups] = useState<ProjectCardData[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')

  useEffect(() => {
    Promise.all([
      fetch('/api/guides').then(r => r.json()).catch(() => []),
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/usage').then(r => r.json()).catch(() => null),
    ]).then(([g, p, u]) => {
      setGuides(g)
      setGroups(p)
      setUsage(u)
      setLoaded(true)
    })
  }, [])

  function handleGenerate() {
    if (files.length === 0) return
    setPending({ files, mode })
    router.push('/generate')
  }

  const recentGuides = guides.slice(0, 4)
  const recentGroups = groups.slice(0, 3)

  const totalTokens = usage?.totalTokens ?? null
  const estimatedCostUsd = usage?.estimatedCostUsd ?? null

  function formatTokens(n: number | null): string {
    if (n === null) return '—'
    return n.toLocaleString('en-US')
  }

  function formatCost(n: number | null): string {
    if (n === null) return '$0.00'
    return `$${n.toFixed(4)}`
  }

  type StatCard =
    | { label: string; value: string; href: string; linked: true }
    | { label: string; value: string; linked: false }

  const stats: StatCard[] = [
    { label: 'Guides', value: loaded ? String(guides.length) : '—', href: '/guides', linked: true },
    { label: 'Groups', value: loaded ? String(groups.length) : '—', href: '/groups', linked: true },
    { label: 'Tokens', value: loaded ? formatTokens(totalTokens) : '—', linked: false },
    { label: 'Est. Cost', value: loaded ? formatCost(estimatedCostUsd) : '—', linked: false },
  ]

  return (
    <div className="flex flex-1 flex-col px-6 py-10 max-w-5xl mx-auto w-full">

      {/* Header */}
      <div className="mb-10">
        <h1
          className="text-3xl font-bold tracking-tight mb-1"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
        >
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your study activity at a glance.
        </p>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-4 gap-px mb-10 rounded-lg overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        {stats.map(stat => {
          const inner = (
            <div className="flex flex-col gap-1">
              <span
                className="text-3xl font-bold tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
              >
                {stat.value}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                {stat.label}
              </span>
            </div>
          )

          if (stat.linked) {
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group flex items-center justify-between px-6 py-5 transition-colors"
                style={{ background: 'var(--background)' }}
              >
                {inner}
                <span
                  className="text-sm transition-transform group-hover:translate-x-0.5"
                  style={{ color: 'var(--muted-dark)' }}
                >
                  →
                </span>
              </Link>
            )
          }

          return (
            <div
              key={stat.label}
              className="flex items-center px-6 py-5"
              style={{ background: 'var(--background)' }}
            >
              {inner}
            </div>
          )
        })}
      </div>

      {/* Main grid: generate + recent */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">

        {/* Left: recent guides */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Recent Guides
            </h2>
            <Link href="/guides" className="text-xs" style={{ color: 'var(--muted)' }}>
              View all →
            </Link>
          </div>

          {!loaded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-20 rounded-lg"
                  style={{ background: 'var(--surface)', animation: 'loading-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}

          {loaded && recentGuides.length === 0 && (
            <div
              className="flex flex-col items-center justify-center rounded-lg border py-12 text-center gap-3"
              style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
            >
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No guides yet.</p>
              <Link
                href="/guides"
                className="text-xs font-semibold px-4 py-1.5 rounded-full"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Create your first guide →
              </Link>
            </div>
          )}

          {loaded && recentGuides.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentGuides.map(guide => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          )}
        </div>

        {/* Right: quick generate + recent groups */}
        <div className="flex flex-col gap-8">

          {/* Quick generate */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Quick Generate
            </h2>
            <div
              className="flex flex-col gap-4 rounded-lg border p-5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <UploadZone onFilesChange={setFiles} compact />
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Mode:</span>
                <div
                  className="flex rounded border overflow-hidden text-xs"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {(['math-cs', 'humanities'] as GuideMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="px-3 py-1 font-medium transition-colors"
                      style={{
                        background: mode === m ? 'var(--accent)' : 'var(--background)',
                        color: mode === m ? '#fff' : 'var(--muted)',
                      }}
                    >
                      {m === 'math-cs' ? 'Math / CS' : 'Humanities'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={files.length === 0}
                className="w-full rounded py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Generate Guide →
              </button>
            </div>
          </div>

          {/* Recent groups */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Groups
              </h2>
              <Link href="/groups" className="text-xs" style={{ color: 'var(--muted)' }}>
                View all →
              </Link>
            </div>

            {loaded && recentGroups.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>No groups yet.</p>
            )}

            {loaded && recentGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                {recentGroups.map(g => (
                  <Link
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className="flex flex-col gap-1 rounded-lg border px-4 py-3 transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                  >
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {g.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {g.fileCount} {g.fileCount === 1 ? 'file' : 'files'} · {g.guideCount} {g.guideCount === 1 ? 'guide' : 'guides'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/DashboardPage.test.tsx
```

Expected: PASS, 6 tests

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx __tests__/DashboardPage.test.tsx
git commit -m "feat: display token usage and cost on dashboard"
```
