# Mobile Guide View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Guide view fully usable on mobile by adding a bottom nav bar, bottom sheets for TOC and chat, and long-press to trigger the "Ask" context menu.

**Architecture:** All changes land in two files — `GuideElement.tsx` (long-press) and `GuideView.tsx` (bottom nav + sheets). No new files. Desktop layout is untouched.

**Tech Stack:** React, Next.js (App Router), Tailwind CSS, Jest + @testing-library/react

---

## File Map

| File | Change |
|------|--------|
| `components/GuideElement.tsx` | Add touch long-press handlers to open context menu |
| `app/guide/[id]/GuideView.tsx` | Add `mobileSheet` state, bottom nav bar, TOC sheet, chat sheet, scroll padding |
| `__tests__/GuideElement.test.tsx` | Add long-press test |
| `__tests__/GuideView.test.tsx` | Create — test mobile nav and sheets |

---

## Task 1: Long-press on GuideElement

**Files:**
- Modify: `components/GuideElement.tsx`
- Modify: `__tests__/GuideElement.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/GuideElement.test.tsx` (inside the existing `describe` block, after existing tests):

```tsx
it('opens context menu after a 500ms long-press', () => {
  jest.useFakeTimers()
  render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={() => {}} onNoteChange={() => {}} />)
  const content = screen.getByText(/Maxwell's equations/)

  fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
  expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

  act(() => { jest.advanceTimersByTime(500) })
  expect(screen.getByText('Ask about this')).toBeInTheDocument()

  jest.useRealTimers()
})

it('does not open context menu if touch ends before 500ms', () => {
  jest.useFakeTimers()
  render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={() => {}} onNoteChange={() => {}} />)
  const content = screen.getByText(/Maxwell's equations/)

  fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
  fireEvent.touchEnd(content)
  act(() => { jest.advanceTimersByTime(500) })
  expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

  jest.useRealTimers()
})
```

Also add these imports at the top of `__tests__/GuideElement.test.tsx`:

```tsx
import { act, fireEvent } from '@testing-library/react'
```

(Merge with the existing `import { render, screen } from '@testing-library/react'` line.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jake/Projects/reduce && npx jest __tests__/GuideElement.test.tsx --no-coverage
```

Expected: the two new tests FAIL (long-press handlers not yet implemented).

- [ ] **Step 3: Implement long-press in GuideElement**

In `components/GuideElement.tsx`, add a ref for the timer just after the existing refs (after `const dragState = useRef...`):

```tsx
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
```

Add these three handler functions just after `handleContextMenu`:

```tsx
function handleTouchStart(e: React.TouchEvent) {
  const touch = e.touches[0]
  longPressTimer.current = setTimeout(() => {
    setCtxMenu({ x: touch.clientX, y: touch.clientY })
  }, 500)
}

function handleTouchEnd() {
  if (longPressTimer.current !== null) {
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }
}
```

In the outer `<div>` (the one with `data-testid` and `onContextMenu`), add the touch handlers:

```tsx
<div
  data-testid={`guide-element-${element.id}`}
  className="relative"
  onContextMenu={handleContextMenu}
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  onTouchMove={handleTouchEnd}
>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/jake/Projects/reduce && npx jest __tests__/GuideElement.test.tsx --no-coverage
```

Expected: ALL tests PASS (including the two existing ones).

- [ ] **Step 5: Commit**

```bash
cd /Users/jake/Projects/reduce && git add components/GuideElement.tsx __tests__/GuideElement.test.tsx && git commit -m "feat: add long-press to open context menu on mobile"
```

---

## Task 2: Mobile bottom nav bar

**Files:**
- Modify: `app/guide/[id]/GuideView.tsx`
- Create: `__tests__/GuideView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/GuideView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuideView from '@/app/guide/[id]/GuideView'
import type { Guide } from '@/types/guide'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

jest.mock('@/components/GuideElement', () => ({
  __esModule: true,
  default: ({ element }: { element: { content: string } }) => <div>{element.content}</div>,
  MarkdownMessage: ({ content }: { content: string }) => <span>{content}</span>,
}))

const MOCK_GUIDE: Guide = {
  id: 'g1',
  title: 'Physics 101',
  mode: 'math-cs',
  createdAt: '2026-04-09',
  sections: [
    { id: 's1', heading: 'Introduction', elements: [{ id: 'e1', type: 'paragraph', content: 'Hello world' }] },
    { id: 's2', heading: 'Chapter Two', elements: [{ id: 'e2', type: 'paragraph', content: 'Second section' }] },
  ],
}

describe('GuideView — mobile bottom nav', () => {
  it('renders the bottom nav bar with three buttons', () => {
    render(<GuideView guide={MOCK_GUIDE} />)
    expect(screen.getByRole('button', { name: /contents/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guide/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/jake/Projects/reduce && npx jest __tests__/GuideView.test.tsx --no-coverage
```

Expected: FAIL — the nav buttons don't exist yet.

- [ ] **Step 3: Add mobileSheet state and bottom nav bar to GuideView**

In `app/guide/[id]/GuideView.tsx`, add `mobileSheet` state after the existing `chatWidth` state:

```tsx
const [mobileSheet, setMobileSheet] = useState<'toc' | 'chat' | null>(null)
```

At the very end of the returned JSX, just before the closing `</div>` of the outer `flex flex-col flex-1 min-h-0` div, add the bottom nav bar:

```tsx
{/* Mobile bottom nav bar */}
<nav
  className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
  style={{
    borderColor: 'var(--border)',
    background: 'var(--background)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  }}
>
  <button
    aria-label="Contents"
    onClick={() => setMobileSheet(s => s === 'toc' ? null : 'toc')}
    className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity"
    style={{ color: mobileSheet === 'toc' ? 'var(--accent)' : 'var(--muted)' }}
  >
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 3.5h11M2 7.5h7M2 11.5h9" />
    </svg>
    <span className="text-[10px] font-medium">Contents</span>
  </button>
  <button
    aria-label="Guide"
    onClick={() => setMobileSheet(null)}
    className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity"
    style={{ color: mobileSheet === null ? 'var(--accent)' : 'var(--muted)' }}
  >
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="11" height="13" rx="1" />
      <path d="M5 5h5M5 8h5M5 11h3" />
    </svg>
    <span className="text-[10px] font-medium">Guide</span>
  </button>
  <button
    aria-label="Chat"
    onClick={() => setMobileSheet(s => s === 'chat' ? null : 'chat')}
    className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity"
    style={{ color: mobileSheet === 'chat' ? 'var(--accent)' : 'var(--muted)' }}
  >
    <svg width="18" height="18" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2.5V3a1 1 0 0 1 1-1z" />
    </svg>
    <span className="text-[10px] font-medium">Chat</span>
  </button>
</nav>
```

Also add bottom padding to the scroll content div so the last elements are not hidden behind the nav bar. Find this line in `GuideView.tsx`:

```tsx
<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollBehavior: 'smooth' }}>
```

Change it to:

```tsx
<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 pb-20 md:pb-6" style={{ scrollBehavior: 'smooth' }}>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/jake/Projects/reduce && npx jest __tests__/GuideView.test.tsx --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jake/Projects/reduce && git add app/guide/[id]/GuideView.tsx __tests__/GuideView.test.tsx && git commit -m "feat: add mobile bottom nav bar to guide view"
```

---

## Task 3: TOC bottom sheet

**Files:**
- Modify: `app/guide/[id]/GuideView.tsx`
- Modify: `__tests__/GuideView.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to the `describe` block in `__tests__/GuideView.test.tsx`:

```tsx
it('opens the TOC sheet when Contents is tapped', async () => {
  const user = userEvent.setup()
  render(<GuideView guide={MOCK_GUIDE} />)

  await user.click(screen.getByRole('button', { name: /contents/i }))
  expect(screen.getByRole('heading', { name: /contents/i })).toBeInTheDocument()
  expect(screen.getByText('1. Introduction')).toBeInTheDocument()
  expect(screen.getByText('2. Chapter Two')).toBeInTheDocument()
})

it('closes the TOC sheet when a section link is tapped', async () => {
  const user = userEvent.setup()
  render(<GuideView guide={MOCK_GUIDE} />)

  await user.click(screen.getByRole('button', { name: /contents/i }))
  await user.click(screen.getByText('1. Introduction'))
  expect(screen.queryByRole('heading', { name: /contents/i })).not.toBeInTheDocument()
})

it('closes the TOC sheet when Guide button is tapped', async () => {
  const user = userEvent.setup()
  render(<GuideView guide={MOCK_GUIDE} />)

  await user.click(screen.getByRole('button', { name: /contents/i }))
  await user.click(screen.getByRole('button', { name: /guide/i }))
  expect(screen.queryByRole('heading', { name: /contents/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jake/Projects/reduce && npx jest __tests__/GuideView.test.tsx --no-coverage
```

Expected: the three new tests FAIL.

- [ ] **Step 3: Add TOC bottom sheet to GuideView**

In `app/guide/[id]/GuideView.tsx`, add the TOC sheet inside the `<div className="flex flex-1 min-h-0 overflow-hidden relative">` body div, just before the closing `</div>` of that div (before the mobile nav bar):

```tsx
{/* Mobile TOC sheet */}
{mobileSheet === 'toc' && (
  <div className="md:hidden">
    {/* Backdrop */}
    <div
      className="fixed inset-0 z-30"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => setMobileSheet(null)}
    />
    {/* Sheet */}
    <div
      className="fixed left-0 right-0 z-40 rounded-t-2xl border-t border-x flex flex-col"
      style={{
        bottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
        height: '75vh',
        background: 'var(--background)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="rounded-full" style={{ width: '2rem', height: '3px', background: 'var(--border)' }} />
      </div>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--muted)' }}
        >
          Contents
        </h2>
        <button
          onClick={() => setMobileSheet(null)}
          aria-label="Close contents"
          className="flex items-center justify-center rounded-lg w-8 h-8"
          style={{ color: 'var(--muted)' }}
        >
          <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>
      {/* Section list */}
      <div className="overflow-y-auto flex flex-col gap-1 px-4 py-4">
        {guide.sections.map((section, i) => {
          const isActive = activeSection === section.id
          return (
            <a
              key={section.id}
              href={`#section-${section.id}`}
              onClick={() => {
                setActiveSection(section.id)
                setMobileSheet(null)
              }}
              className="text-xs py-1.5 px-2 rounded transition-colors"
              style={{
                color: isActive ? 'var(--foreground)' : 'var(--muted)',
                fontWeight: isActive ? '600' : '400',
                background: isActive ? 'var(--border)' : 'transparent',
              }}
            >
              {i + 1}. {section.heading}
            </a>
          )
        })}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/jake/Projects/reduce && npx jest __tests__/GuideView.test.tsx --no-coverage
```

Expected: ALL tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jake/Projects/reduce && git add app/guide/[id]/GuideView.tsx __tests__/GuideView.test.tsx && git commit -m "feat: add mobile TOC bottom sheet"
```

---

## Task 4: Chat bottom sheet

**Files:**
- Modify: `app/guide/[id]/GuideView.tsx`
- Modify: `__tests__/GuideView.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/GuideView.test.tsx`:

```tsx
it('opens the chat sheet when Chat is tapped', async () => {
  const user = userEvent.setup()
  render(<GuideView guide={MOCK_GUIDE} />)

  await user.click(screen.getByRole('button', { name: /^chat$/i }))
  expect(screen.getByRole('heading', { name: /^ask$/i })).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/ask…/i)).toBeInTheDocument()
})

it('closes the chat sheet when Guide button is tapped', async () => {
  const user = userEvent.setup()
  render(<GuideView guide={MOCK_GUIDE} />)

  await user.click(screen.getByRole('button', { name: /^chat$/i }))
  await user.click(screen.getByRole('button', { name: /guide/i }))
  expect(screen.queryByRole('heading', { name: /^ask$/i })).not.toBeInTheDocument()
})

it('closes the chat sheet when backdrop is tapped', async () => {
  const user = userEvent.setup()
  render(<GuideView guide={MOCK_GUIDE} />)

  await user.click(screen.getByRole('button', { name: /^chat$/i }))
  // The backdrop is the first child of the sheet wrapper
  const backdrop = document.querySelector('[data-testid="chat-sheet-backdrop"]') as HTMLElement
  await user.click(backdrop)
  expect(screen.queryByRole('heading', { name: /^ask$/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jake/Projects/reduce && npx jest __tests__/GuideView.test.tsx --no-coverage
```

Expected: the three new tests FAIL.

- [ ] **Step 3: Add the chat bottom sheet to GuideView**

First, add a `useEffect` in `GuideView.tsx` to auto-focus the chat input when the sheet opens. Add it after the existing `useEffect` blocks:

```tsx
useEffect(() => {
  if (mobileSheet === 'chat') {
    setTimeout(() => chatInputRef.current?.focus(), 50)
  }
}, [mobileSheet])
```

Then add the chat sheet JSX in `app/guide/[id]/GuideView.tsx`, directly after the closing `</div>` of the TOC sheet wrapper (still inside the body div, before the bottom nav):

```tsx
{/* Mobile Chat sheet */}
{mobileSheet === 'chat' && (
  <div className="md:hidden">
    {/* Backdrop */}
    <div
      data-testid="chat-sheet-backdrop"
      className="fixed inset-0 z-30"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => setMobileSheet(null)}
    />
    {/* Sheet */}
    <div
      className="fixed left-0 right-0 z-40 rounded-t-2xl border-t border-x flex flex-col"
      style={{
        bottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
        height: '75vh',
        background: 'var(--background)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="rounded-full" style={{ width: '2rem', height: '3px', background: 'var(--border)' }} />
      </div>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--muted)' }}
        >
          Ask
        </h2>
        <button
          onClick={() => setMobileSheet(null)}
          aria-label="Close chat"
          className="flex items-center justify-center rounded-lg w-8 h-8"
          style={{ color: 'var(--muted)' }}
        >
          <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
        {guideMessages.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Ask anything about this guide.</p>
        )}
        {guideMessages.map(msg => (
          <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            <div
              className="text-xs rounded-lg px-3 py-2 max-w-[85%]"
              style={{
                background: msg.role === 'user' ? 'var(--border)' : 'transparent',
                color: 'var(--foreground)',
              }}
            >
              {msg.role === 'assistant'
                ? <MarkdownMessage content={msg.content || (chatLoading ? '…' : '')} />
                : msg.content}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      {/* Input */}
      <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2 items-center rounded-lg px-3 py-2" style={{ background: 'var(--border)' }}>
          <input
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleGuideChatSend()
              }
            }}
            placeholder="Ask…"
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--foreground)' }}
          />
          <button
            onClick={handleGuideChatSend}
            disabled={!chatInput.trim() || chatLoading}
            aria-label="Send"
            className="shrink-0 transition-opacity disabled:opacity-30"
            style={{ color: 'var(--foreground)' }}
          >
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 7.5h13M8 2l6 5.5-6 5.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/jake/Projects/reduce && npx jest --no-coverage
```

Expected: ALL tests PASS, including the existing GuideElement and other suites.

- [ ] **Step 5: Commit**

```bash
cd /Users/jake/Projects/reduce && git add app/guide/[id]/GuideView.tsx __tests__/GuideView.test.tsx && git commit -m "feat: add mobile chat bottom sheet"
```
