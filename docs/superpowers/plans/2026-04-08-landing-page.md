# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public marketing landing page at `/` with an interactive demo, moving the authenticated dashboard to `/app`.

**Architecture:** The proxy (middleware) is updated to make `/` public. The current dashboard (`app/page.tsx`) moves to `app/app/page.tsx` unchanged. A new `app/page.tsx` server component renders the landing page for unauthenticated users and redirects logged-in users to `/app`. A new `LandingDemo` client component renders real `GuideElement` items with hardcoded BST sample data and a scripted streaming response for `onAsk`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, `@testing-library/react`, Jest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `proxy.ts` | Modify | Add `'/'` to `PUBLIC_PATHS` |
| `app/app/page.tsx` | Create | Dashboard (moved from `app/page.tsx`) |
| `app/page.tsx` | Replace | Landing page server component |
| `components/LandingDemo.tsx` | Create | Interactive demo widget |
| `__tests__/LandingDemo.test.tsx` | Create | Tests for demo component |
| `__tests__/LandingPage.test.tsx` | Create | Tests for landing page |
| `__tests__/AppPage.test.tsx` | Create | Tests for dashboard at `/app` |

---

## Task 1: Make `/` public and move dashboard to `/app`

**Files:**
- Modify: `proxy.ts`
- Create: `app/app/page.tsx`
- Create: `__tests__/AppPage.test.tsx`

- [ ] **Step 1: Write the failing test for the dashboard at `/app`**

Create `__tests__/AppPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import AppPage from '@/app/app/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/pendingGeneration', () => ({
  setPending: jest.fn(),
}))

global.fetch = jest.fn().mockResolvedValue({
  json: async () => [],
}) as jest.Mock

describe('AppPage (/app)', () => {
  it('renders the upload zone', async () => {
    render(<AppPage />)
    await waitFor(() => {
      expect(screen.getByText(/upload/i)).toBeInTheDocument()
    })
  })

  it('renders the mode toggle', async () => {
    render(<AppPage />)
    await waitFor(() => {
      expect(screen.getByText('Math / CS')).toBeInTheDocument()
      expect(screen.getByText('Humanities')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/AppPage.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/app/page'`

- [ ] **Step 3: Create `app/app/page.tsx` with the current dashboard content**

Create `app/app/page.tsx` with the exact content currently in `app/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'
import GuideCard from '@/components/GuideCard'
import type { GuideCardData, GuideMode } from '@/types/guide'
import { setPending } from '@/lib/pendingGeneration'

export default function AppPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')
  const [guides, setGuides] = useState<GuideCardData[]>([])

  useEffect(() => {
    fetch('/api/guides')
      .then(r => r.json())
      .then(setGuides)
      .catch(() => {})
  }, [])

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
        {guides.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Recent Guides
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {guides.map(guide => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/AppPage.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Add `/` to PUBLIC_PATHS in `proxy.ts`**

```ts
const PUBLIC_PATHS = ['/', '/login', '/register']
```

- [ ] **Step 6: Commit**

```bash
git add proxy.ts app/app/page.tsx __tests__/AppPage.test.tsx
git commit -m "feat: move dashboard to /app, make / public"
```

---

## Task 2: Create the LandingDemo component

**Files:**
- Create: `components/LandingDemo.tsx`
- Create: `__tests__/LandingDemo.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/LandingDemo.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LandingDemo from '@/components/LandingDemo'

// GuideElement uses createPortal — stub it for jsdom
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

describe('LandingDemo', () => {
  it('renders the demo section heading', () => {
    render(<LandingDemo />)
    expect(screen.getByText(/from notes to guide/i)).toBeInTheDocument()
  })

  it('renders all four sample guide elements', () => {
    render(<LandingDemo />)
    // heading element content
    expect(screen.getByText('Binary Search Trees')).toBeInTheDocument()
    // paragraph element content
    expect(screen.getByText(/BST invariant/i)).toBeInTheDocument()
  })

  it('renders a Try it free link pointing to /register', () => {
    render(<LandingDemo />)
    const link = screen.getByRole('link', { name: /try it free/i })
    expect(link).toHaveAttribute('href', '/register')
  })

  it('typing a question and submitting calls the scripted onAsk handler', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(<LandingDemo />)

    // Right-click the paragraph element to open context menu
    const paragraph = screen.getByText(/BST invariant/i)
    await user.pointer({ keys: '[MouseRight]', target: paragraph })

    // Click "Ask about this" in context menu
    await user.click(screen.getByText(/ask about this/i))

    // Type a question and submit
    const input = screen.getByPlaceholderText(/what does this mean/i)
    await user.type(input, 'explain this')
    await user.click(screen.getByRole('button', { name: /submit question/i }))

    // Advance timers to let scripted streaming complete
    act(() => { jest.runAllTimers() })

    expect(screen.getByText(/BST invariant is what makes/i)).toBeInTheDocument()

    jest.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/LandingDemo.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/LandingDemo'`

- [ ] **Step 3: Create `components/LandingDemo.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import GuideElement from '@/components/GuideElement'
import type { ContentElement, ChatMessage } from '@/types/guide'

const DEMO_ELEMENTS: ContentElement[] = [
  {
    id: 'demo-heading',
    type: 'heading',
    level: 2,
    content: 'Binary Search Trees',
  },
  {
    id: 'demo-paragraph',
    type: 'paragraph',
    content:
      'A binary search tree (BST) is a node-based data structure where each node has at most two children. For any node, all values in the left subtree are smaller, and all values in the right subtree are larger — this is the BST invariant.',
  },
  {
    id: 'demo-code',
    type: 'code',
    language: 'python',
    content:
      'def search(node, target):\n    if node is None or node.val == target:\n        return node\n    if target < node.val:\n        return search(node.left, target)\n    return search(node.right, target)',
  },
  {
    id: 'demo-formula',
    type: 'formula',
    content: 'T(n) = O(\\log n) \\text{ (average case)}',
  },
]

const SCRIPTED_RESPONSES: Record<string, string> = {
  'demo-heading':
    'A Binary Search Tree is a fundamental data structure. The key property is that for every node, all values in its left subtree are smaller, and all values in its right subtree are larger. This invariant makes search, insert, and delete operations efficient at O(log n) on average.',
  'demo-paragraph':
    'The BST invariant is what makes the tree useful. Because smaller values always go left and larger values always go right, we can do binary search — at each node we eliminate half the remaining tree. This is why BSTs achieve O(log n) average-case operations.',
  'demo-code':
    "This recursive search function compares the target to the current node's value. If the target is smaller, go left; if larger, go right. Base cases: node is null (not found) or node.val equals target (found). Time complexity is O(h) where h is the height of the tree.",
  'demo-formula':
    'O(log n) average-case complexity assumes the tree is reasonably balanced. In the worst case — a sorted input creating a degenerate linear tree — operations degrade to O(n). This is why self-balancing variants like AVL trees and Red-Black trees exist.',
}

let msgIdCounter = 0
function nextId() { return `demo-msg-${++msgIdCounter}` }

export default function LandingDemo() {
  const [elementChats, setElementChats] = useState<Map<string, ChatMessage[]>>(new Map())
  const [elementNotes, setElementNotes] = useState<Map<string, string>>(new Map())
  const [loadingElementId, setLoadingElementId] = useState<string | null>(null)

  function handleAsk(element: ContentElement, question: string) {
    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: question,
      contextElementId: element.id,
    }
    setElementChats(prev => {
      const next = new Map(prev)
      next.set(element.id, [...(prev.get(element.id) ?? []), userMsg])
      return next
    })

    setLoadingElementId(element.id)

    const response = SCRIPTED_RESPONSES[element.id] ?? 'Great question! This is a key concept in the material.'
    const assistantMsgId = nextId()

    // Seed an empty assistant message
    setElementChats(prev => {
      const next = new Map(prev)
      const existing = prev.get(element.id) ?? []
      const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '' }
      next.set(element.id, [...existing, assistantMsg])
      return next
    })

    // Stream characters one at a time
    let i = 0
    const interval = setInterval(() => {
      i++
      setElementChats(prev => {
        const next = new Map(prev)
        const msgs = prev.get(element.id) ?? []
        next.set(
          element.id,
          msgs.map(m => m.id === assistantMsgId ? { ...m, content: response.slice(0, i) } : m),
        )
        return next
      })
      if (i >= response.length) {
        clearInterval(interval)
        setLoadingElementId(null)
      }
    }, 20)
  }

  function handleNoteChange(elementId: string, note: string) {
    setElementNotes(prev => new Map(prev).set(elementId, note))
  }

  return (
    <section className="py-16 px-6" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-8">
        <div className="text-center">
          <div
            className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'var(--accent)' }}
          >
            See it in action
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            From notes to guide in seconds.
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Here&apos;s a sample guide — right-click any section to ask a question.
          </p>
        </div>

        {/* Guide widget */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {/* Guide header */}
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div
              className="text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: 'var(--accent)' }}
            >
              Data Structures — Week 4
            </div>
            <div className="text-base font-bold tracking-tight">Binary Search Trees</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              4 elements · right-click any section to ask
            </div>
          </div>

          {/* Elements */}
          <div className="px-6 py-4 flex flex-col gap-1">
            {DEMO_ELEMENTS.map(el => (
              <GuideElement
                key={el.id}
                element={el}
                messages={elementChats.get(el.id) ?? []}
                note={elementNotes.get(el.id) ?? ''}
                loading={loadingElementId === el.id}
                onAsk={handleAsk}
                onNoteChange={handleNoteChange}
              />
            ))}
          </div>

          {/* Widget footer CTA */}
          <div
            className="px-6 py-3 flex items-center justify-between border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
          >
            <span className="text-xs" style={{ color: 'var(--muted-dark)' }}>
              Upload your own notes to generate a guide like this
            </span>
            <Link
              href="/register"
              className="text-xs font-semibold rounded-full px-4 py-1.5"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Try it free →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/LandingDemo.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/LandingDemo.tsx __tests__/LandingDemo.test.tsx
git commit -m "feat: add LandingDemo component with scripted interactive guide"
```

---

## Task 3: Create the landing page at `/`

**Files:**
- Replace: `app/page.tsx`
- Create: `__tests__/LandingPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/LandingPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import LandingPage from '@/app/page'

jest.mock('@/auth', () => ({
  auth: jest.fn().mockResolvedValue(null),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

jest.mock('@/components/LandingDemo', () => ({
  __esModule: true,
  default: () => <div data-testid="landing-demo" />,
}))

import { redirect } from 'next/navigation'
import { auth } from '@/auth'

describe('LandingPage (/)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(auth as jest.Mock).mockResolvedValue(null)
  })

  it('renders the hero headline', async () => {
    render(await LandingPage())
    expect(screen.getByText(/upload your notes/i)).toBeInTheDocument()
    expect(screen.getByText(/get the tldr/i)).toBeInTheDocument()
  })

  it('renders Start studying CTA linking to /register', async () => {
    render(await LandingPage())
    const cta = screen.getByRole('link', { name: /start studying/i })
    expect(cta).toHaveAttribute('href', '/register')
  })

  it('renders Sign in link linking to /login', async () => {
    render(await LandingPage())
    const signIn = screen.getAllByRole('link', { name: /sign in/i })
    expect(signIn[0]).toHaveAttribute('href', '/login')
  })

  it('renders the LandingDemo component', async () => {
    render(await LandingPage())
    expect(screen.getByTestId('landing-demo')).toBeInTheDocument()
  })

  it('redirects to /app when authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    await LandingPage()
    expect(redirect).toHaveBeenCalledWith('/app')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/LandingPage.test.tsx --no-coverage
```

Expected: FAIL — landing page doesn't exist yet / missing hero text

- [ ] **Step 3: Replace `app/page.tsx` with the landing page**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import LandingDemo from '@/components/LandingDemo'

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect('/app')

  return (
    <div className="flex flex-1 flex-col">

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-16">
        <div
          className="text-xs font-semibold tracking-widest uppercase mb-5"
          style={{ color: 'var(--accent)' }}
        >
          AI study guides
        </div>
        <h1 className="text-5xl font-bold tracking-tight leading-tight mb-5 max-w-xl">
          upload your notes.<br />
          <span style={{ color: 'var(--accent)' }}>get the tldr.</span>
        </h1>
        <p className="text-base mb-9 max-w-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Drop in your lecture notes, slides, or PDFs — get a structured,
          interactive study guide back in seconds.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="rounded-full px-6 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Start studying free →
          </Link>
          <a
            href="#demo"
            className="text-sm"
            style={{ color: 'var(--muted)' }}
          >
            See how it works ↓
          </a>
        </div>
        <p className="mt-5 text-xs" style={{ color: 'var(--muted-dark)' }}>
          No credit card. Works with PDFs, slides, and plain text.
        </p>
      </section>

      {/* Demo */}
      <div id="demo">
        <LandingDemo />
      </div>

      {/* Features */}
      <section className="py-16 px-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div
              className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: 'var(--accent)' }}
            >
              How it works
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Three steps to a better study session.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                emoji: '📄',
                title: 'Upload your material',
                body: 'PDFs, slides, lecture notes, or plain text. Any format, any subject.',
              },
              {
                emoji: '✨',
                title: 'Get a structured guide',
                body: 'AI breaks it into sections with explanations, formulas, code blocks, and timelines.',
              },
              {
                emoji: '💬',
                title: 'Ask about anything',
                body: 'Right-click any section and ask questions. The AI explains using your own material.',
              },
            ].map(({ emoji, title, body }) => (
              <div
                key={title}
                className="rounded-xl border p-6"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="text-2xl mb-4">{emoji}</div>
                <div className="text-sm font-bold mb-2">{title}</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-4">
          ready to study smarter?
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Free to get started. No credit card required.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full px-7 py-3 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Create your first guide →
          </Link>
          <Link href="/login" className="text-sm" style={{ color: 'var(--muted)' }}>
            Sign in
          </Link>
        </div>
      </section>

    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/LandingPage.test.tsx --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: All tests pass. If any pre-existing tests fail, investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx __tests__/LandingPage.test.tsx
git commit -m "feat: add landing page with hero, demo, features, and CTA"
```
