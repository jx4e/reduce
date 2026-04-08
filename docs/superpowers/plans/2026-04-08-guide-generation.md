# Guide Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up real guide generation — users upload PDF/text files, Claude produces structured JSON, the guide is stored in localStorage and displayed in the existing GuideView.

**Architecture:** Files are sent to `POST /api/guides/generate` as multipart form data. The server converts PDFs to base64 document blocks and text files to text blocks, then calls `claude-sonnet-4-6` with a mode-specific system prompt that instructs it to return a JSON guide. The client stores the response in localStorage and navigates to `/guide/[id]`.

**Tech Stack:** `@anthropic-ai/sdk`, Next.js App Router API routes, browser `localStorage`, Jest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/anthropic.ts` | Create | Anthropic client singleton, system prompt builder, file→content block converter |
| `app/api/guides/generate/route.ts` | Create | POST handler: parse form, call Claude, assign IDs, return Guide JSON |
| `lib/pendingGeneration.ts` | Create | Module-level store to pass files from home page to generate page |
| `app/page.tsx` | Modify | Call `setPending` + navigate to `/generate` on submit |
| `app/generate/page.tsx` | Modify | Read pending, POST to API, show stepper, save result, redirect |
| `app/guide/[id]/GuideClientLoader.tsx` | Create | Client component: reads guide from localStorage, renders GuideView |
| `app/guide/[id]/page.tsx` | Modify | Replace mock data lookup with `<GuideClientLoader id={id} />` |
| `__tests__/lib/anthropic.test.ts` | Create | Tests for `buildSystemPrompt` and `fileToContentBlock` |
| `__tests__/components/GuideClientLoader.test.tsx` | Create | Tests for localStorage read + render |

---

## Task 1: Install Anthropic SDK and add env placeholder

**Files:**
- Modify: `package.json` (via npm)
- Create: `.env.local`

- [ ] **Step 1: Install the SDK**

```bash
npm install @anthropic-ai/sdk
```

Expected: `@anthropic-ai/sdk` appears in `package.json` dependencies.

- [ ] **Step 2: Create `.env.local` with API key placeholder**

Create the file `.env.local` in the project root:

```env
ANTHROPIC_API_KEY=your-key-here
```

- [ ] **Step 3: Verify `.env.local` is gitignored**

```bash
grep -r '\.env\.local' .gitignore
```

If not present, add it. Next.js gitignores `.env.local` by default — confirm it's there.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @anthropic-ai/sdk"
```

---

## Task 2: Build `lib/anthropic.ts` — client, prompt builder, file converter

**Files:**
- Create: `lib/anthropic.ts`
- Create: `__tests__/lib/anthropic.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/anthropic.test.ts`:

```ts
import { buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'

describe('buildSystemPrompt', () => {
  it('includes LaTeX and code instructions for math-cs mode', () => {
    const prompt = buildSystemPrompt('math-cs')
    expect(prompt).toContain('formula')
    expect(prompt).toContain('code')
    expect(prompt).toContain('LaTeX')
  })

  it('includes timeline instructions for humanities mode', () => {
    const prompt = buildSystemPrompt('humanities')
    expect(prompt).toContain('timeline')
  })

  it('instructs Claude to return raw JSON only', () => {
    const prompt = buildSystemPrompt('math-cs')
    expect(prompt).toContain('raw JSON')
  })
})

describe('fileToContentBlock', () => {
  it('converts a PDF file to a base64 document block', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]) // %PDF magic bytes
    const file = new File([bytes], 'notes.pdf', { type: 'application/pdf' })
    const block = await fileToContentBlock(file)
    expect(block.type).toBe('document')
    if (block.type === 'document') {
      expect(block.source.type).toBe('base64')
      expect(block.source.media_type).toBe('application/pdf')
      expect(typeof block.source.data).toBe('string')
    }
  })

  it('converts a text file to a text block', async () => {
    const file = new File(['# Hello\nSome notes'], 'notes.md', { type: 'text/plain' })
    const block = await fileToContentBlock(file)
    expect(block.type).toBe('text')
    if (block.type === 'text') {
      expect(block.text).toContain('Hello')
    }
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npx jest __tests__/lib/anthropic.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/anthropic'`

- [ ] **Step 3: Implement `lib/anthropic.ts`**

Create `lib/anthropic.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { GuideMode } from '@/types/guide'

// ── Singleton client ──────────────────────────────────────────────────────────

let _client: Anthropic | null = null

export function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// ── Prompt builder ────────────────────────────────────────────────────────────

const SCHEMA = `
{
  "title": "string — concise title for this guide",
  "sections": [
    {
      "heading": "string — section title",
      "elements": [
        { "type": "paragraph", "content": "string" },
        { "type": "heading", "content": "string", "level": 2 },
        { "type": "formula", "content": "LaTeX string — KaTeX-compatible, no $ delimiters" },
        { "type": "code", "content": "string", "language": "python|javascript|..." },
        {
          "type": "timeline",
          "content": "brief label",
          "events": [{ "date": "string", "title": "string", "description": "string" }]
        }
      ]
    }
  ]
}`.trim()

const MODE_GUIDANCE: Record<GuideMode, string> = {
  'math-cs': `
- Use "formula" elements (LaTeX) for all equations and mathematical expressions.
- Use "code" elements for algorithms, implementations, and examples.
- Use "timeline" only if the material explicitly covers historical developments.
- Prefer precision over narrative.`.trim(),
  'humanities': `
- Use "timeline" elements for historical sequences; include 5–10 events minimum.
- Use "paragraph" elements for analysis, context, and argument.
- Use "formula" only if the source material contains explicit equations.
- Prefer narrative clarity and structured argument over bullet lists.`.trim(),
}

export function buildSystemPrompt(mode: GuideMode): string {
  return `You are an expert study guide creator. Analyse the provided learning material and produce a structured study guide.

Return ONLY a valid JSON object — no prose, no markdown code fences, no explanation. Just raw JSON.

The JSON must follow this schema exactly:

${SCHEMA}

Do NOT include "id" fields — they will be assigned automatically.
Produce 4–8 sections with a natural mix of element types suited to the material.

Mode-specific guidance (mode: ${mode}):
${MODE_GUIDANCE[mode]}`
}

// ── File → content block ──────────────────────────────────────────────────────

type DocumentBlock = {
  type: 'document'
  source: { type: 'base64'; media_type: 'application/pdf'; data: string }
}

type TextBlock = {
  type: 'text'
  text: string
}

export type ContentBlock = DocumentBlock | TextBlock

export async function fileToContentBlock(file: File): Promise<ContentBlock> {
  if (file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    }
  }
  const text = await file.text()
  return { type: 'text', text }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npx jest __tests__/lib/anthropic.test.ts --no-coverage
```

Expected: PASS (3 tests in `buildSystemPrompt`, 2 in `fileToContentBlock`)

- [ ] **Step 5: Commit**

```bash
git add lib/anthropic.ts __tests__/lib/anthropic.test.ts
git commit -m "feat: add Anthropic client, prompt builder, and file converter"
```

---

## Task 3: Build `app/api/guides/generate/route.ts`

**Files:**
- Create: `app/api/guides/generate/route.ts`

No direct Jest test for the route handler (it requires the full Next.js runtime). The validation logic is thin enough to verify manually. E2E behaviour is covered by the integration test in Task 7.

- [ ] **Step 1: Create the route handler**

Create `app/api/guides/generate/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient, buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'
import type { Guide, GuideSection, ContentElement, GuideMode } from '@/types/guide'

const ALLOWED_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown'])

// Raw shape Claude returns (no ids)
interface ClaudeElement {
  type: ContentElement['type']
  content?: string
  level?: 2 | 3
  language?: string
  events?: ContentElement['events']
}

interface ClaudeSection {
  heading: string
  elements: ClaudeElement[]
}

interface ClaudeGuide {
  title: string
  sections: ClaudeSection[]
}

function assignIds(raw: ClaudeGuide, mode: GuideMode): Guide {
  const sections: GuideSection[] = raw.sections.map(s => ({
    id: randomUUID(),
    heading: s.heading,
    elements: s.elements.map(el => ({
      id: randomUUID(),
      type: el.type,
      content: el.content ?? '',
      ...(el.level !== undefined && { level: el.level }),
      ...(el.language !== undefined && { language: el.language }),
      ...(el.events !== undefined && { events: el.events }),
    } as ContentElement)),
  }))

  return {
    id: randomUUID(),
    title: raw.title,
    mode,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    sections,
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const mode = (formData.get('mode') ?? 'math-cs') as GuideMode

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const badFile = files.find(f => !ALLOWED_TYPES.has(f.type))
  if (badFile) {
    return NextResponse.json(
      { error: `Unsupported file type: ${badFile.type}. Allowed: PDF, plain text, markdown.` },
      { status: 400 },
    )
  }

  const contentBlocks = await Promise.all(files.map(fileToContentBlock))

  const client = getClient()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: buildSystemPrompt(mode),
    messages: [
      {
        role: 'user',
        content: [
          ...contentBlocks,
          { type: 'text', text: 'Generate a study guide from the material above.' },
        ],
      },
    ],
  })

  const rawText = message.content.find(b => b.type === 'text')?.text ?? ''

  let parsed: ClaudeGuide
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 })
  }

  const guide = assignIds(parsed, mode)
  return NextResponse.json(guide)
}
```

- [ ] **Step 2: Verify the file compiles with no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add app/api/guides/generate/route.ts
git commit -m "feat: add guide generation API route"
```

---

## Task 4: Build `lib/pendingGeneration.ts` and update `app/page.tsx`

**Files:**
- Create: `lib/pendingGeneration.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create the pending generation store**

Create `lib/pendingGeneration.ts`:

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

export function consumePending(): PendingGeneration | null {
  const p = pending
  pending = null
  return p
}
```

- [ ] **Step 2: Update `app/page.tsx` — set pending and navigate**

Replace the `handleGenerate` function in `app/page.tsx`. The full updated file:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'
import GuideCard from '@/components/GuideCard'
import { setPending } from '@/lib/pendingGeneration'
import type { GuideCardData, GuideMode } from '@/types/guide'

const MOCK_GUIDES: GuideCardData[] = [
  { id: '1', title: 'Electromagnetism — Maxwell\'s Equations', createdAt: 'Apr 5, 2026', mode: 'math-cs' },
  { id: '2', title: 'The French Revolution: Causes and Consequences', createdAt: 'Apr 3, 2026', mode: 'humanities' },
  { id: '3', title: 'Data Structures: Trees and Graphs', createdAt: 'Apr 1, 2026', mode: 'math-cs' },
]

export default function HomePage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')

  function handleGenerate() {
    if (files.length === 0) return
    setPending({ files, mode })
    router.push('/generate')
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-10">

        {/* Upload section */}
        <section className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload your material
          </h1>

          <UploadZone onFilesChange={setFiles} />

          {/* Mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Mode:</span>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {(['math-cs', 'humanities'] as GuideMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-4 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: mode === m ? 'var(--accent)' : 'var(--surface)',
                    color: mode === m ? '#fff' : 'var(--muted)',
                  }}
                >
                  {m === 'math-cs' ? 'Math / CS' : 'Humanities'}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={files.length === 0}
            className="self-center flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Generate Guide →
          </button>
        </section>

        {/* Recent guides */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Recent Guides
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MOCK_GUIDES.map(guide => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/pendingGeneration.ts app/page.tsx
git commit -m "feat: store pending generation and navigate to /generate"
```

---

## Task 5: Update `app/generate/page.tsx` — real fetch with loading + error state

**Files:**
- Modify: `app/generate/page.tsx`

- [ ] **Step 1: Replace `app/generate/page.tsx` with the real generation flow**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Stepper from '@/components/Stepper'
import { consumePending } from '@/lib/pendingGeneration'
import type { Guide } from '@/types/guide'

const STAGES = ['Parsing', 'Analyzing', 'Writing', 'Rendering']

export default function GeneratePage() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Guard against double-invocation in React Strict Mode
    if (started.current) return
    started.current = true

    const pending = consumePending()
    if (!pending) {
      router.replace('/')
      return
    }

    // Animate the stepper while the fetch runs
    const interval = setInterval(() => {
      setCurrentStage(s => Math.min(s + 1, STAGES.length - 1))
    }, 1500)

    // Run the real generation
    ;(async () => {
      try {
        const formData = new FormData()
        pending.files.forEach(f => formData.append('files', f))
        formData.append('mode', pending.mode)

        const res = await fetch('/api/guides/generate', { method: 'POST', body: formData })
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Generation failed' }))
          throw new Error(body.error ?? 'Generation failed')
        }

        const guide: Guide = await res.json()
        localStorage.setItem(guide.id, JSON.stringify(guide))
        router.push(`/guide/${guide.id}`)
      } catch (err) {
        clearInterval(interval)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })()

    return () => clearInterval(interval)
  }, [router])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Generation failed
        </p>
        <p className="text-xs max-w-sm" style={{ color: 'var(--muted)' }}>
          {error}
        </p>
        <Link
          href="/"
          className="text-xs font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          ← Try again
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Generating your guide…
      </p>
      <Stepper stages={STAGES} currentStage={currentStage} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/generate/page.tsx
git commit -m "feat: wire real generation fetch into generate page"
```

---

## Task 6: Create `GuideClientLoader` and update the guide page

**Files:**
- Create: `app/guide/[id]/GuideClientLoader.tsx`
- Modify: `app/guide/[id]/page.tsx`
- Create: `__tests__/components/GuideClientLoader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/GuideClientLoader.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import GuideClientLoader from '@/app/guide/[id]/GuideClientLoader'
import type { Guide } from '@/types/guide'

// Mock GuideView so we don't render its full tree in jsdom
jest.mock('@/app/guide/[id]/GuideView', () => ({
  __esModule: true,
  default: ({ guide }: { guide: Guide }) => <div>{guide.title}</div>,
}))

const MOCK_GUIDE: Guide = {
  id: 'test-123',
  title: 'Test Guide',
  mode: 'math-cs',
  createdAt: 'Apr 8, 2026',
  sections: [
    {
      id: 's1',
      heading: 'Introduction',
      elements: [{ id: 'e1', type: 'paragraph', content: 'Hello world' }],
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
})

it('renders the guide title when found in localStorage', async () => {
  localStorage.setItem('test-123', JSON.stringify(MOCK_GUIDE))
  render(<GuideClientLoader id="test-123" />)
  await waitFor(() => expect(screen.getByText('Test Guide')).toBeInTheDocument())
})

it('shows a not-found message when the guide is missing from localStorage', async () => {
  render(<GuideClientLoader id="missing-id" />)
  await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
npx jest __tests__/components/GuideClientLoader.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/guide/[id]/GuideClientLoader'`

- [ ] **Step 3: Create `app/guide/[id]/GuideClientLoader.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import GuideView from './GuideView'
import type { Guide } from '@/types/guide'

export default function GuideClientLoader({ id }: { id: string }) {
  const [guide, setGuide] = useState<Guide | null | 'not-found'>(null)

  useEffect(() => {
    const stored = localStorage.getItem(id)
    if (stored) {
      setGuide(JSON.parse(stored) as Guide)
    } else {
      setGuide('not-found')
    }
  }, [id])

  if (guide === null) {
    // Still loading from localStorage (first render)
    return null
  }

  if (guide === 'not-found') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-sm font-semibold">Guide not found</p>
        <Link href="/" className="text-xs" style={{ color: 'var(--accent)' }}>
          ← Back to home
        </Link>
      </div>
    )
  }

  return <GuideView guide={guide} />
}
```

- [ ] **Step 4: Run test — expect it to pass**

```bash
npx jest __tests__/components/GuideClientLoader.test.tsx --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Update `app/guide/[id]/page.tsx`**

Replace the entire file:

```tsx
import GuideClientLoader from './GuideClientLoader'

export default async function GuidePage(props: PageProps<'/guide/[id]'>) {
  const { id } = await props.params
  return <GuideClientLoader id={id} />
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/guide/[id]/GuideClientLoader.tsx app/guide/[id]/page.tsx __tests__/components/GuideClientLoader.test.tsx
git commit -m "feat: load guide from localStorage in guide page"
```

---

## Task 7: Smoke test the full flow

**No code changes — manual verification only.**

- [ ] **Step 1: Add your real Anthropic API key to `.env.local`**

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Upload a small PDF or `.txt` file and click Generate Guide**

Navigate to `http://localhost:3000`. Upload a file, select a mode, click Generate Guide.

Expected:
1. Navigates to `/generate` — stepper animates
2. After 10–30 seconds — navigates to `/guide/[uuid]`
3. Guide title and sections render correctly
4. Elements display in correct types (paragraph, formula, code, etc.)

- [ ] **Step 4: Refresh the guide page**

Expected: guide still displays (persisted in localStorage).

- [ ] **Step 5: Test error handling — upload an unsupported file type**

Upload a `.jpg` file. Click Generate Guide.

Expected: generate page shows "Generation failed" with a "← Try again" link.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: <description of any fixes>"
```
