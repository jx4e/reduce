# Parallel Agent Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `GuideView.tsx` (640 lines) and `GuideElement.tsx` (478 lines) into focused files with explicit TypeScript contracts so parallel agents can work without merge conflicts.

**Architecture:** Extract logic into four custom hooks (`useResizable`, `useGuideScroll`, `useElementChat`, `useGuideChat`), split UI into focused components (`GuideTOC`, `GuideContent`, `GuideChatPanel`), and split element rendering into per-type components under `components/elements/`. `GuideView` shrinks to a thin orchestrator (~100 lines). `GuideElement` shrinks to ~80 lines by delegating rendering to the element registry and chat state to `useElementChat`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Jest + @testing-library/react, Tailwind CSS, KaTeX, highlight.js, react-markdown

---

## File Map

**Create:**
- `lib/chat.ts` — shared `streamChat` fetch utility and `nextId` message ID generator
- `hooks/useResizable.ts` — chat panel drag-to-resize logic
- `hooks/useGuideScroll.ts` — active section detection + `scrollToSection`
- `hooks/useElementChat.ts` — per-element chat state and streaming
- `hooks/useGuideChat.ts` — guide-level chat state and streaming
- `components/elements/MarkdownContent.tsx` — shared ReactMarkdown renderer
- `components/elements/HeadingElement.tsx`
- `components/elements/ParagraphElement.tsx`
- `components/elements/FormulaElement.tsx`
- `components/elements/CodeElement.tsx`
- `components/elements/ImageElement.tsx`
- `components/elements/TimelineElement.tsx`
- `components/elements/index.ts` — registry mapping `ContentElementType` → component
- `components/guide/GuideTOC.tsx` — desktop sidebar + mobile TOC sheet
- `components/guide/GuideContent.tsx` — renders guide sections + elements
- `components/guide/GuideChatPanel.tsx` — desktop chat panel + mobile chat sheet
- `__tests__/hooks/useElementChat.test.ts`
- `__tests__/hooks/useGuideChat.test.ts`
- `__tests__/components/GuideTOC.test.tsx`
- `__tests__/components/GuideChatPanel.test.tsx`

**Modify:**
- `components/GuideElement.tsx` — remove element renderers + external state; use registry + `useElementChat`
- `app/guide/[id]/GuideView.tsx` — replace body with composed components
- `__tests__/GuideElement.test.tsx` — update props (remove `messages`, `note`, `onAsk`, `onNoteChange`; add `guideId`)
- `__tests__/GuideView.test.tsx` — update mocks for `GuideChatPanel` and `GuideTOC`

---

### Task 1: Create shared chat utilities

**Files:**
- Create: `lib/chat.ts`

- [ ] **Step 1: Write the file**

```typescript
// lib/chat.ts
import type { ChatRequestBody, ChatEvent } from '@/app/api/guides/[id]/chat/route'

let msgIdCounter = 0
export function nextId(): string {
  return `msg-${++msgIdCounter}`
}

export async function streamChat(
  guideId: string,
  body: ChatRequestBody,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/guides/${guideId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Chat failed' }))
    throw new Error(err.error ?? 'Chat failed')
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
      const event: ChatEvent = JSON.parse(line.slice(6))
      if (event.type === 'delta') onDelta(event.text)
      else if (event.type === 'error') throw new Error(event.message)
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/chat.ts
git commit -m "refactor: extract shared streamChat and nextId to lib/chat.ts"
```

---

### Task 2: Create useResizable hook

**Files:**
- Create: `hooks/useResizable.ts`

- [ ] **Step 1: Write the hook**

```typescript
// hooks/useResizable.ts
'use client'

import { useRef, useState } from 'react'

const MIN_WIDTH = 220
const MAX_WIDTH = 560

export interface UseResizableReturn {
  width: number
  isDragging: boolean
  handlePointerDown: (e: React.PointerEvent) => void
  handlePointerMove: (e: React.PointerEvent) => void
  handlePointerUp: () => void
}

export function useResizable(initialWidth = 300): UseResizableReturn {
  const [width, setWidth] = useState(initialWidth)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    dragRef.current = { startX: e.clientX, startW: width }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const delta = dragRef.current.startX - e.clientX
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startW + delta)))
  }

  function handlePointerUp() {
    dragRef.current = null
    setIsDragging(false)
  }

  return { width, isDragging, handlePointerDown, handlePointerMove, handlePointerUp }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add hooks/useResizable.ts
git commit -m "refactor: extract useResizable hook"
```

---

### Task 3: Create useGuideScroll hook

**Files:**
- Create: `hooks/useGuideScroll.ts`

- [ ] **Step 1: Write the hook**

```typescript
// hooks/useGuideScroll.ts
'use client'

import { useEffect, useRef, useState } from 'react'
import type { GuideSection } from '@/types/guide'

export interface UseGuideScrollReturn {
  activeSection: string
  contentRef: React.RefObject<HTMLDivElement>
  scrollToSection: (id: string) => void
}

export function useGuideScroll(sections: GuideSection[]): UseGuideScrollReturn {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? '')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#section-')) {
      const sectionId = hash.slice('#section-'.length)
      if (sections.some(s => s.id === sectionId)) {
        setActiveSection(sectionId)
        document.getElementById(`section-${sectionId}`)?.scrollIntoView()
      }
    }
  }, [])

  useEffect(() => {
    const scrollEl = contentRef.current
    if (!scrollEl) return

    function updateActive() {
      const { scrollTop, clientHeight, scrollHeight } = scrollEl!
      if (scrollTop + clientHeight >= scrollHeight - 4) {
        setActiveSection(sections[sections.length - 1]?.id ?? '')
        return
      }
      const threshold = clientHeight * 0.25
      let active = sections[0]?.id ?? ''
      for (const section of sections) {
        const el = scrollEl!.querySelector(`#section-${section.id}`) as HTMLElement | null
        if (el && el.offsetTop - scrollTop <= threshold) active = section.id
      }
      setActiveSection(active)
    }

    scrollEl.addEventListener('scroll', updateActive, { passive: true })
    return () => scrollEl.removeEventListener('scroll', updateActive)
  }, [sections])

  function scrollToSection(id: string) {
    setActiveSection(id)
    document.getElementById(`section-${id}`)?.scrollIntoView()
  }

  return { activeSection, contentRef, scrollToSection }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add hooks/useGuideScroll.ts
git commit -m "refactor: extract useGuideScroll hook"
```

---

### Task 4: Create useElementChat hook + tests

**Files:**
- Create: `hooks/useElementChat.ts`
- Create: `__tests__/hooks/useElementChat.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/hooks/useElementChat.test.ts
import { renderHook, act } from '@testing-library/react'
import { useElementChat } from '@/hooks/useElementChat'
import type { ContentElement } from '@/types/guide'

const element: ContentElement = { id: 'el-1', type: 'paragraph', content: 'Hello' }

global.fetch = jest.fn()

describe('useElementChat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts with empty messages and not loading', () => {
    const { result } = renderHook(() => useElementChat('guide-1', element))
    expect(result.current.messages).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('adds user and assistant messages when send is called', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"delta","text":"Hi"}\n\n'))
        controller.close()
      },
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, body: stream.getReader().constructor === ReadableStreamDefaultReader ? stream : stream })

    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"delta","text":"Hi"}\n\n'))
          controller.close()
        },
      }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useElementChat('guide-1', element))
    await act(async () => { result.current.send('What does this mean?') })

    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'What does this mean?' })
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant' })
  })
})
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx jest __tests__/hooks/useElementChat.test.ts --no-coverage
```
Expected: FAIL with "Cannot find module '@/hooks/useElementChat'"

- [ ] **Step 3: Write the hook**

```typescript
// hooks/useElementChat.ts
'use client'

import { useState } from 'react'
import { streamChat, nextId } from '@/lib/chat'
import type { ChatMessage, ContentElement } from '@/types/guide'

export interface UseElementChatReturn {
  messages: ChatMessage[]
  loading: boolean
  send: (question: string) => Promise<void>
}

export function useElementChat(guideId: string, element: ContentElement): UseElementChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  async function send(question: string) {
    if (loading) return
    setLoading(true)

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: question }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])

    const history = [...messages, userMsg]

    try {
      await streamChat(
        guideId,
        {
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context: { element: { type: element.type, content: element.content } },
        },
        (chunk) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          )
        },
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m)
      )
    } finally {
      setLoading(false)
    }
  }

  return { messages, loading, send }
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npx jest __tests__/hooks/useElementChat.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useElementChat.ts __tests__/hooks/useElementChat.test.ts
git commit -m "refactor: extract useElementChat hook"
```

---

### Task 5: Create useGuideChat hook + tests

**Files:**
- Create: `hooks/useGuideChat.ts`
- Create: `__tests__/hooks/useGuideChat.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/hooks/useGuideChat.test.ts
import { renderHook, act } from '@testing-library/react'
import { useGuideChat } from '@/hooks/useGuideChat'
import type { Guide } from '@/types/guide'

const guide: Guide = {
  id: 'g1',
  title: 'Physics 101',
  mode: 'math-cs',
  createdAt: '2026-04-10',
  sections: [{ id: 's1', heading: 'Intro', elements: [] }],
}

global.fetch = jest.fn()

describe('useGuideChat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts with empty messages and not loading', () => {
    const { result } = renderHook(() => useGuideChat(guide))
    expect(result.current.messages).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.input).toBe('')
  })

  it('updates input via setInput', () => {
    const { result } = renderHook(() => useGuideChat(guide))
    act(() => { result.current.setInput('Hello') })
    expect(result.current.input).toBe('Hello')
  })
})
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx jest __tests__/hooks/useGuideChat.test.ts --no-coverage
```
Expected: FAIL with "Cannot find module '@/hooks/useGuideChat'"

- [ ] **Step 3: Write the hook**

```typescript
// hooks/useGuideChat.ts
'use client'

import { useRef, useState } from 'react'
import { streamChat, nextId } from '@/lib/chat'
import type { ChatMessage, Guide } from '@/types/guide'

export interface UseGuideChatReturn {
  messages: ChatMessage[]
  loading: boolean
  input: string
  setInput: (value: string) => void
  send: () => Promise<void>
  chatEndRef: React.RefObject<HTMLDivElement>
  inputRef: React.RefObject<HTMLInputElement>
}

export function useGuideChat(guide: Guide): UseGuideChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)

    const context = {
      guideTitle: guide.title,
      sectionHeadings: guide.sections.map(s => s.heading),
    }

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: q }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    const history = [...messages, userMsg]

    try {
      await streamChat(
        guide.id,
        { messages: history.map(m => ({ role: m.role, content: m.content })), context },
        (chunk) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          )
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m)
      )
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return { messages, loading, input, setInput, send, chatEndRef, inputRef }
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npx jest __tests__/hooks/useGuideChat.test.ts --no-coverage
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useGuideChat.ts __tests__/hooks/useGuideChat.test.ts
git commit -m "refactor: extract useGuideChat hook"
```

---

### Task 6: Create element components and registry

**Files:**
- Create: `components/elements/MarkdownContent.tsx`
- Create: `components/elements/HeadingElement.tsx`
- Create: `components/elements/ParagraphElement.tsx`
- Create: `components/elements/FormulaElement.tsx`
- Create: `components/elements/CodeElement.tsx`
- Create: `components/elements/ImageElement.tsx`
- Create: `components/elements/TimelineElement.tsx`
- Create: `components/elements/index.ts`

- [ ] **Step 1: Create MarkdownContent.tsx**

```typescript
// components/elements/MarkdownContent.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'

export function MarkdownContent({ content }: { content: string }) {
  if (!content) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => (
          <code className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: 'var(--border)' }}>
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="rounded p-2 text-xs font-mono overflow-x-auto my-1" style={{ background: 'var(--border)' }}>
            {children}
          </pre>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse" style={{ borderColor: 'var(--border)' }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr style={{ borderBottom: '1px solid var(--border)' }}>{children}</tr>,
        th: ({ children }) => (
          <th className="px-2 py-1 text-left font-semibold" style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>{children}</th>
        ),
        td: ({ children }) => <td className="px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
```

- [ ] **Step 2: Create HeadingElement.tsx**

```typescript
// components/elements/HeadingElement.tsx
'use client'

import type { ContentElement } from '@/types/guide'

export function HeadingElement({ element }: { element: ContentElement }) {
  return element.level === 3
    ? <h3 className="text-base font-semibold mt-4 mb-1">{element.content}</h3>
    : <h2 className="text-lg font-semibold mt-6 mb-2">{element.content}</h2>
}
```

- [ ] **Step 3: Create ParagraphElement.tsx**

```typescript
// components/elements/ParagraphElement.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import type { ContentElement } from '@/types/guide'

export function ParagraphElement({ element }: { element: ContentElement }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <p className="text-sm leading-7" style={{ color: 'var(--foreground)' }}>{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: 'var(--border)' }}>{children}</code>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse" style={{ borderColor: 'var(--border)' }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr style={{ borderBottom: '1px solid var(--border)' }}>{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold" style={{ background: 'var(--surface)', color: 'var(--foreground)', borderBottom: '2px solid var(--border)' }}>{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-xs" style={{ color: 'var(--foreground)' }}>{children}</td>
        ),
      }}
    >
      {element.content}
    </ReactMarkdown>
  )
}
```

- [ ] **Step 4: Create FormulaElement.tsx**

```typescript
// components/elements/FormulaElement.tsx
'use client'

import katex from 'katex'
import type { ContentElement } from '@/types/guide'

export function FormulaElement({ element }: { element: ContentElement }) {
  let html: string
  try {
    html = katex.renderToString(element.content, { displayMode: true, throwOnError: false })
  } catch {
    html = element.content
  }
  return (
    <div
      className="my-3 overflow-x-auto rounded-md px-4 py-3"
      style={{ background: 'var(--surface)', borderLeft: '3px solid var(--accent)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

- [ ] **Step 5: Create CodeElement.tsx**

```typescript
// components/elements/CodeElement.tsx
'use client'

import { useState } from 'react'
import hljs from 'highlight.js'
import type { ContentElement } from '@/types/guide'

export function CodeElement({ element }: { element: ContentElement }) {
  const [copied, setCopied] = useState(false)
  const { content, language } = element

  let html: string
  try {
    html = language && hljs.getLanguage(language)
      ? hljs.highlight(content, { language }).value
      : hljs.highlightAuto(content).value
  } catch {
    html = content
  }

  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-3 group/code">
      <pre className="overflow-x-auto rounded-md text-sm" style={{ background: 'var(--surface)' }}>
        <code
          className={language ? `language-${language}` : ''}
          style={{ display: 'block', padding: '0.75rem 1rem' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
      <button
        onClick={handleCopy}
        aria-label="Copy code"
        className="absolute top-2 right-2 rounded px-2 py-1 text-xs transition-all opacity-0 group-hover/code:opacity-100"
        style={{ background: 'var(--border)', color: copied ? 'var(--accent)' : 'var(--muted)' }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Create ImageElement.tsx**

```typescript
// components/elements/ImageElement.tsx
'use client'

import type { ContentElement } from '@/types/guide'

export function ImageElement({ element }: { element: ContentElement }) {
  return (
    <figure className="my-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={element.src}
        alt={element.content}
        className="rounded-md w-full object-contain"
        style={{ maxHeight: '20rem', background: 'var(--surface)' }}
      />
      {element.content && (
        <figcaption className="mt-1.5 text-xs text-center" style={{ color: 'var(--muted)' }}>
          {element.content}
        </figcaption>
      )}
    </figure>
  )
}
```

- [ ] **Step 7: Create TimelineElement.tsx**

```typescript
// components/elements/TimelineElement.tsx
'use client'

import type { ContentElement } from '@/types/guide'

export function TimelineElement({ element }: { element: ContentElement }) {
  const events = element.events ?? []
  return (
    <div className="my-3 flex flex-col" style={{ paddingLeft: '1rem' }}>
      {events.map((event, i) => (
        <div key={i} className="relative flex gap-4" style={{ paddingBottom: i < events.length - 1 ? '1.5rem' : 0 }}>
          <div className="flex flex-col items-center shrink-0" style={{ width: '1rem' }}>
            <div className="rounded-full shrink-0" style={{ width: '0.5rem', height: '0.5rem', marginTop: '0.35rem', background: 'var(--accent)' }} />
            {i < events.length - 1 && (
              <div className="flex-1 mt-1" style={{ width: '1px', background: 'var(--border)' }} />
            )}
          </div>
          <div className="flex flex-col gap-0.5 pb-0.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{event.date}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{event.title}</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{event.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Create index.ts registry**

Use `React.createElement` instead of JSX so the file stays `.ts` (no JSX extension needed).

```typescript
// components/elements/index.ts
import React from 'react'
import type { ContentElementType, ContentElement } from '@/types/guide'
import { HeadingElement } from './HeadingElement'
import { ParagraphElement } from './ParagraphElement'
import { FormulaElement } from './FormulaElement'
import { CodeElement } from './CodeElement'
import { ImageElement } from './ImageElement'
import { TimelineElement } from './TimelineElement'

type ElementComponent = React.FC<{ element: ContentElement }>

const elementRegistry: Record<ContentElementType, ElementComponent> = {
  heading: HeadingElement,
  paragraph: ParagraphElement,
  formula: FormulaElement,
  code: CodeElement,
  image: ImageElement,
  timeline: TimelineElement,
}

export function renderElement(element: ContentElement): React.ReactElement | null {
  const Component = elementRegistry[element.type]
  return Component ? React.createElement(Component, { element }) : null
}

export { MarkdownContent } from './MarkdownContent'
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add components/elements/
git commit -m "refactor: create element component registry in components/elements/"
```

---

### Task 7: Refactor GuideElement.tsx

Replace the 478-line file with a focused component that delegates rendering to the registry and chat state to `useElementChat`.

**Files:**
- Modify: `components/GuideElement.tsx`
- Modify: `__tests__/GuideElement.test.tsx`

- [ ] **Step 1: Rewrite GuideElement.tsx**

Replace the entire file contents with:

```typescript
// components/GuideElement.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderElement, MarkdownContent } from '@/components/elements'
import { useElementChat } from '@/hooks/useElementChat'
import type { ContentElement } from '@/types/guide'

interface GuideElementProps {
  element: ContentElement
  guideId: string
}

export default function GuideElement({ element, guideId }: GuideElementProps) {
  const { messages, loading, send } = useElementChat(guideId, element)
  const [note, setNote] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [question, setQuestion] = useState('')
  const [previewHeight, setPreviewHeight] = useState(380)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startY: number; startH: number } | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onDragPointerDown(e: React.PointerEvent) {
    dragState.current = { startY: e.clientY, startH: previewHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onDragPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return
    const modalH = modalRef.current?.offsetHeight ?? 480
    const next = Math.min(Math.max(60, dragState.current.startH + (e.clientY - dragState.current.startY)), modalH * 0.72)
    setPreviewHeight(next)
  }

  function onDragPointerUp() { dragState.current = null }

  function openModal(tab: 'chat' | 'notes' = 'chat') {
    setActiveTab(tab)
    setModalOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    longPressTimer.current = setTimeout(() => setCtxMenu({ x: touch.clientX, y: touch.clientY }), 500)
  }

  function handleTouchEnd() {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => () => {
    if (longPressTimer.current !== null) clearTimeout(longPressTimer.current)
  }, [])

  useEffect(() => {
    if (!ctxMenu) return
    function close() { setCtxMenu(null) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  useEffect(() => {
    if (modalOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, modalOpen])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = question.trim() || 'What does this mean?'
    send(text)
    setQuestion('')
  }

  return (
    <div
      data-testid={`guide-element-${element.id}`}
      className="relative"
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <div
        className="py-1 rounded transition-all"
        style={modalOpen ? { outline: '1px solid var(--accent)', outlineOffset: '3px' } : {}}
      >
        {renderElement(element)}
      </div>

      {ctxMenu && createPortal(
        <div
          className="fixed z-[9999] rounded-lg border shadow-xl overflow-hidden"
          style={{ top: ctxMenu.y, left: ctxMenu.x, background: 'var(--surface)', borderColor: 'var(--border)', minWidth: '11rem', animation: 'fade-in 0.1s ease-out' }}
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: 'Ask about this', icon: 'M14 1H2C1.45 1 1 1.45 1 2v9c0 .55.45 1 1 1h2v3l3.5-3H14c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1z', action: () => { setCtxMenu(null); openModal('chat') } },
            { label: 'Add note', icon: 'M13 1H3a2 2 0 0 0-2 2v12l3-3h9a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm-1 9H4V9h8v1zm0-3H4V6h8v1zm0-3H4V3h8v1z', action: () => { setCtxMenu(null); openModal('notes') } },
            { label: 'Copy text', icon: 'M10 1H4a1 1 0 0 0-1 1v1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1h1a1 1 0 0 0 1-1V5l-4-4zm0 1.5L12.5 5H10V2.5zM10 13H2V4h1v8a1 1 0 0 0 1 1h6v1zm3-3H4V2h5v4h4v7z', action: () => { setCtxMenu(null); navigator.clipboard.writeText(element.content) } },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors"
              style={{ color: 'var(--foreground)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', animation: 'fade-in 0.15s ease-out' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '80vh', animation: 'modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div className="px-6 pt-5 pb-4 overflow-y-auto shrink-0" style={{ height: previewHeight }}>
              {renderElement(element)}
            </div>
            <div
              className="shrink-0 flex items-center justify-center border-y cursor-row-resize select-none"
              style={{ height: '12px', borderColor: 'var(--border)', background: 'var(--background)' }}
              onPointerDown={onDragPointerDown}
              onPointerMove={onDragPointerMove}
              onPointerUp={onDragPointerUp}
            >
              <div className="rounded-full" style={{ width: '2rem', height: '3px', background: 'var(--border-hover)' }} />
            </div>
            <div className="flex shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              {(['chat', 'notes'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-5 py-2.5 text-xs font-semibold capitalize transition-colors"
                  style={{ color: activeTab === tab ? 'var(--foreground)' : 'var(--muted)', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent' }}
                >
                  {tab}
                  {tab === 'chat' && messages.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--accent)', color: '#fff' }}>
                      {messages.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {activeTab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
                  {messages.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Ask anything about this — your conversation stays here.</p>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed"
                        style={{ background: msg.role === 'user' ? 'var(--accent)' : 'var(--background)', color: msg.role === 'user' ? '#fff' : 'var(--foreground)', border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none' }}
                      >
                        {msg.role === 'assistant' ? <MarkdownContent content={msg.content} /> : msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="shrink-0 border-t flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                  <input
                    ref={inputRef}
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="What does this mean?"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    onKeyDown={e => { if (e.key === 'Escape') setModalOpen(false) }}
                  />
                  <button
                    type="submit"
                    aria-label="Submit question"
                    disabled={loading}
                    className="rounded-lg px-4 py-2 text-sm font-semibold shrink-0 disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {loading ? '…' : 'Ask →'}
                  </button>
                </form>
              </>
            )}
            {activeTab === 'notes' && (
              <div className="flex-1 flex flex-col min-h-0 px-5 py-4">
                <textarea
                  aria-label="Notes"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Jot down anything about this…"
                  className="flex-1 resize-none rounded-lg border p-3 text-sm leading-relaxed outline-none"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  onKeyDown={e => { if (e.key === 'Escape') setModalOpen(false) }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Keep MarkdownMessage as re-export for backwards compatibility with GuideView tests
export { MarkdownContent as MarkdownMessage } from '@/components/elements'
```

- [ ] **Step 2: Update GuideElement tests**

Replace the entire `__tests__/GuideElement.test.tsx` with:

```typescript
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuideElement from '@/components/GuideElement'
import type { ContentElement } from '@/types/guide'

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

jest.mock('@/hooks/useElementChat', () => ({
  useElementChat: () => ({
    messages: [],
    loading: false,
    send: jest.fn(),
  }),
}))

const paragraphElement: ContentElement = {
  id: 'el-1',
  type: 'paragraph',
  content: "Maxwell's equations describe electromagnetism.",
}

describe('GuideElement', () => {
  it('renders paragraph content', () => {
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    expect(screen.getByText(/Maxwell's equations/)).toBeInTheDocument()
  })

  it('shows context menu on right-click', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)
    await user.pointer({ keys: '[MouseRight]', target: content })
    expect(screen.getByText('Ask about this')).toBeInTheDocument()
  })

  it('opens chat modal when Ask about this is clicked', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)
    await user.pointer({ keys: '[MouseRight]', target: content })
    await user.click(screen.getByText('Ask about this'))
    expect(screen.getByPlaceholderText(/what does this mean/i)).toBeInTheDocument()
  })

  it('opens context menu after a 500ms long-press', () => {
    jest.useFakeTimers()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)

    fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
    expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

    act(() => { jest.advanceTimersByTime(500) })
    expect(screen.getByText('Ask about this')).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('does not open context menu if touch ends before 500ms', () => {
    jest.useFakeTimers()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)

    fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(content)
    act(() => { jest.advanceTimersByTime(500) })
    expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

    jest.useRealTimers()
  })

  it('calls send with question when form submitted', async () => {
    const mockSend = jest.fn()
    const { useElementChat } = jest.requireMock('@/hooks/useElementChat')
    useElementChat.mockReturnValue({ messages: [], loading: false, send: mockSend })

    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText(/Maxwell's equations/) })
    await user.click(screen.getByText('Ask about this'))
    await user.type(screen.getByPlaceholderText(/what does this mean/i), 'What does this mean?')
    await user.click(screen.getByRole('button', { name: /submit question/i }))
    expect(mockSend).toHaveBeenCalledWith('What does this mean?')
  })
})
```

- [ ] **Step 3: Run tests — verify they pass**

```bash
npx jest __tests__/GuideElement.test.tsx --no-coverage
```
Expected: PASS (5 tests)

- [ ] **Step 4: Commit**

```bash
git add components/GuideElement.tsx __tests__/GuideElement.test.tsx
git commit -m "refactor: shrink GuideElement to use element registry and useElementChat"
```

---

### Task 8: Create GuideTOC component + tests

**Files:**
- Create: `components/guide/GuideTOC.tsx`
- Create: `__tests__/components/GuideTOC.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/GuideTOC.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuideTOC } from '@/components/guide/GuideTOC'
import type { GuideSection } from '@/types/guide'

const sections: GuideSection[] = [
  { id: 's1', heading: 'Introduction', elements: [] },
  { id: 's2', heading: 'Chapter Two', elements: [] },
]

describe('GuideTOC', () => {
  it('renders section links in desktop sidebar', () => {
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={() => {}}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    )
    expect(screen.getByText('1. Introduction')).toBeInTheDocument()
    expect(screen.getByText('2. Chapter Two')).toBeInTheDocument()
  })

  it('calls onSectionClick with section id when a link is clicked', async () => {
    const user = userEvent.setup()
    const onSectionClick = jest.fn()
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={onSectionClick}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    )
    await user.click(screen.getByText('2. Chapter Two'))
    expect(onSectionClick).toHaveBeenCalledWith('s2')
  })

  it('renders mobile sheet when mobileOpen is true', () => {
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={() => {}}
        mobileOpen={true}
        onMobileClose={() => {}}
      />
    )
    expect(screen.getByTestId('mobile-toc-section-list')).toBeInTheDocument()
    expect(within(screen.getByTestId('mobile-toc-section-list')).getByText('1. Introduction')).toBeInTheDocument()
  })

  it('calls onMobileClose when a section is clicked in mobile sheet', async () => {
    const user = userEvent.setup()
    const onMobileClose = jest.fn()
    render(
      <GuideTOC
        sections={sections}
        activeSection="s1"
        onSectionClick={() => {}}
        mobileOpen={true}
        onMobileClose={onMobileClose}
      />
    )
    await user.click(within(screen.getByTestId('mobile-toc-section-list')).getByText('1. Introduction'))
    expect(onMobileClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx jest __tests__/components/GuideTOC.test.tsx --no-coverage
```
Expected: FAIL with "Cannot find module '@/components/guide/GuideTOC'"

- [ ] **Step 3: Create GuideTOC.tsx**

```typescript
// components/guide/GuideTOC.tsx
'use client'

import { useState } from 'react'
import type { GuideSection } from '@/types/guide'

interface GuideTOCProps {
  sections: GuideSection[]
  activeSection: string
  onSectionClick: (id: string) => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function GuideTOC({ sections, activeSection, onSectionClick, mobileOpen, onMobileClose }: GuideTOCProps) {
  const [desktopOpen, setDesktopOpen] = useState(true)

  return (
    <>
      {/* Desktop: floating open button when closed */}
      {!desktopOpen && (
        <button
          onClick={() => setDesktopOpen(true)}
          title="Show sidebar"
          className="absolute top-3 left-3 z-10 hidden md:flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
          style={{ background: 'var(--border)', color: 'var(--foreground)' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 3.5h11M2 7.5h7M2 11.5h9" />
          </svg>
        </button>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex shrink-0 flex-col border-r overflow-hidden relative transition-all duration-300 ease-in-out"
        style={{ width: desktopOpen ? '13rem' : '0', borderColor: 'var(--border)' }}
      >
        <div className="w-52 flex flex-col gap-1 px-4 py-6 flex-1 overflow-y-auto">
          <button
            onClick={() => setDesktopOpen(false)}
            title="Hide sidebar"
            className="absolute top-3 right-3 flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
            style={{ background: 'transparent', color: 'var(--muted)' }}
          >
            <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            Contents
          </p>
          {sections.map((section, i) => {
            const isActive = activeSection === section.id
            return (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                onClick={() => onSectionClick(section.id)}
                className="text-xs py-1.5 px-2 rounded transition-colors"
                style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)', fontWeight: isActive ? '600' : '400', background: isActive ? 'var(--border)' : 'transparent' }}
              >
                {i + 1}. {section.heading}
              </a>
            )
          })}
        </div>
      </aside>

      {/* Mobile TOC sheet */}
      {mobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onMobileClose}
          />
          <div
            className="fixed left-0 right-0 z-40 rounded-t-2xl border-t border-x flex flex-col"
            style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))', height: '75vh', background: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="rounded-full" style={{ width: '2rem', height: '3px', background: 'var(--border)' }} />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Contents</h2>
              <button
                onClick={onMobileClose}
                aria-label="Close contents"
                className="flex items-center justify-center rounded-lg w-8 h-8"
                style={{ color: 'var(--muted)' }}
              >
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>
            <div data-testid="mobile-toc-section-list" className="overflow-y-auto flex flex-col gap-1 px-4 py-4">
              {sections.map((section, i) => {
                const isActive = activeSection === section.id
                return (
                  <a
                    key={section.id}
                    href={`#section-${section.id}`}
                    onClick={() => { onSectionClick(section.id); onMobileClose() }}
                    className="text-xs py-1.5 px-2 rounded transition-colors"
                    style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)', fontWeight: isActive ? '600' : '400', background: isActive ? 'var(--border)' : 'transparent' }}
                  >
                    {i + 1}. {section.heading}
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/components/GuideTOC.test.tsx --no-coverage
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/guide/GuideTOC.tsx __tests__/components/GuideTOC.test.tsx
git commit -m "refactor: create GuideTOC component"
```

---

### Task 9: Create GuideContent component

**Files:**
- Create: `components/guide/GuideContent.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/guide/GuideContent.tsx
'use client'

import GuideElement from '@/components/GuideElement'
import type { GuideSection } from '@/types/guide'

interface GuideContentProps {
  sections: GuideSection[]
  guideId: string
  contentRef: React.RefObject<HTMLDivElement>
}

export function GuideContent({ sections, guideId, contentRef }: GuideContentProps) {
  return (
    <div
      ref={contentRef}
      className="flex-1 overflow-y-auto px-6 py-6 pb-20 md:pb-6"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {sections.map(section => (
          <section key={section.id} id={`section-${section.id}`}>
            <h2 className="text-lg font-semibold mb-4">{section.heading}</h2>
            <div className="flex flex-col gap-2">
              {section.elements.map(element => (
                <GuideElement key={element.id} element={element} guideId={guideId} />
              ))}
            </div>
          </section>
        ))}
        <div className="h-[75vh]" aria-hidden="true" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/guide/GuideContent.tsx
git commit -m "refactor: create GuideContent component"
```

---

### Task 10: Create GuideChatPanel component + tests

**Files:**
- Create: `components/guide/GuideChatPanel.tsx`
- Create: `__tests__/components/GuideChatPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/GuideChatPanel.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuideChatPanel } from '@/components/guide/GuideChatPanel'
import type { Guide } from '@/types/guide'

const guide: Guide = {
  id: 'g1',
  title: 'Physics 101',
  mode: 'math-cs',
  createdAt: '2026-04-10',
  sections: [{ id: 's1', heading: 'Intro', elements: [] }],
}

jest.mock('@/hooks/useGuideChat', () => ({
  useGuideChat: () => ({
    messages: [],
    loading: false,
    input: '',
    setInput: jest.fn(),
    send: jest.fn(),
    chatEndRef: { current: null },
    inputRef: { current: null },
  }),
}))

describe('GuideChatPanel', () => {
  it('renders the Ask placeholder in mobile sheet when mobileOpen', () => {
    render(
      <GuideChatPanel
        guide={guide}
        mobileOpen={true}
        onMobileClose={() => {}}
      />
    )
    expect(screen.getByTestId('mobile-chat-sheet')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/ask…/i)).toBeInTheDocument()
  })

  it('calls onMobileClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onMobileClose = jest.fn()
    render(
      <GuideChatPanel
        guide={guide}
        mobileOpen={true}
        onMobileClose={onMobileClose}
      />
    )
    await user.click(screen.getByTestId('chat-sheet-backdrop'))
    expect(onMobileClose).toHaveBeenCalled()
  })

  it('does not render the mobile sheet when mobileOpen is false', () => {
    render(
      <GuideChatPanel
        guide={guide}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    )
    expect(screen.queryByTestId('mobile-chat-sheet')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx jest __tests__/components/GuideChatPanel.test.tsx --no-coverage
```
Expected: FAIL with "Cannot find module '@/components/guide/GuideChatPanel'"

- [ ] **Step 3: Write GuideChatPanel.tsx**

```typescript
// components/guide/GuideChatPanel.tsx
'use client'

import { useRef, useState } from 'react'
import { useGuideChat } from '@/hooks/useGuideChat'
import { MarkdownContent } from '@/components/elements'
import { useResizable } from '@/hooks/useResizable'
import type { Guide } from '@/types/guide'

interface GuideChatPanelProps {
  guide: Guide
  mobileOpen: boolean
  onMobileClose: () => void
}

export function GuideChatPanel({ guide, mobileOpen, onMobileClose }: GuideChatPanelProps) {
  const { messages, loading, input, setInput, send, chatEndRef, inputRef } = useGuideChat(guide)
  const { width, isDragging, handlePointerDown, handlePointerMove, handlePointerUp } = useResizable(300)
  const [desktopOpen, setDesktopOpen] = useState(false)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const messageList = (
    <>
      {messages.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Ask anything about this guide.</p>
      )}
      {messages.map(msg => (
        <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
          <div
            className="text-xs rounded-lg px-3 py-2 max-w-[85%]"
            style={{ background: msg.role === 'user' ? 'var(--border)' : 'transparent', color: 'var(--foreground)' }}
          >
            {msg.role === 'assistant'
              ? <MarkdownContent content={msg.content || (loading ? '…' : '')} />
              : msg.content}
          </div>
        </div>
      ))}
      <div ref={chatEndRef} />
    </>
  )

  const inputBar = (inputRefProp: React.RefObject<HTMLInputElement>, extraStyle?: React.CSSProperties) => (
    <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex gap-2 items-center rounded-lg px-3 py-2" style={{ background: 'var(--border)' }}>
        <input
          ref={inputRefProp}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask…"
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--foreground)', ...extraStyle }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="shrink-0 transition-opacity disabled:opacity-30"
          style={{ color: 'var(--foreground)' }}
        >
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 7.5h13M8 2l6 5.5-6 5.5" />
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: floating open button when closed */}
      {!desktopOpen && (
        <button
          onClick={() => { setDesktopOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
          title="Toggle ask panel"
          className="absolute bottom-3 right-3 z-10 hidden md:flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
          style={{ background: 'var(--border)', color: 'var(--foreground)' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2.5V3a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex shrink-0 flex-col border-l overflow-hidden relative"
        style={{ width: desktopOpen ? `${width}px` : '0', borderColor: 'var(--border)', transition: isDragging ? 'none' : 'width 300ms ease-in-out' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-400 hover:opacity-40 transition-opacity"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        <div className="flex flex-col h-full" style={{ width }}>
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Ask</p>
            <button
              onClick={() => setDesktopOpen(false)}
              title="Close ask panel"
              className="flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
              style={{ background: 'transparent', color: 'var(--muted)' }}
            >
              <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messageList}
          </div>
          {inputBar(inputRef)}
        </div>
      </aside>

      {/* Mobile chat sheet */}
      {mobileOpen && (
        <div className="md:hidden">
          <div
            data-testid="chat-sheet-backdrop"
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onMobileClose}
          />
          <div
            data-testid="mobile-chat-sheet"
            className="fixed left-0 right-0 z-40 rounded-t-2xl border-t border-x flex flex-col"
            style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))', height: '75vh', background: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="rounded-full" style={{ width: '2rem', height: '3px', background: 'var(--border)' }} />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Ask</h2>
              <button
                onClick={onMobileClose}
                aria-label="Close chat"
                className="flex items-center justify-center rounded-lg w-8 h-8"
                style={{ color: 'var(--muted)' }}
              >
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
              {messageList}
            </div>
            {inputBar(mobileInputRef, { fontSize: '16px' })}
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/components/GuideChatPanel.test.tsx --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/guide/GuideChatPanel.tsx __tests__/components/GuideChatPanel.test.tsx
git commit -m "refactor: create GuideChatPanel component"
```

---

### Task 11: Refactor GuideView.tsx

Replace the 640-line orchestrator with a ~80-line thin shell.

**Files:**
- Modify: `app/guide/[id]/GuideView.tsx`
- Modify: `__tests__/GuideView.test.tsx`

- [ ] **Step 1: Rewrite GuideView.tsx**

Replace the entire file contents with:

```typescript
// app/guide/[id]/GuideView.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GuideTOC } from '@/components/guide/GuideTOC'
import { GuideContent } from '@/components/guide/GuideContent'
import { GuideChatPanel } from '@/components/guide/GuideChatPanel'
import { useGuideScroll } from '@/hooks/useGuideScroll'
import type { Guide } from '@/types/guide'

export default function GuideView({ guide }: { guide: Guide }) {
  const { activeSection, contentRef, scrollToSection } = useGuideScroll(guide.sections)
  const [mobileSheet, setMobileSheet] = useState<'toc' | 'chat' | null>(null)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-semibold truncate flex-1">{guide.title}</h1>
        <Link href="/" className="text-sm transition-colors shrink-0" style={{ color: 'var(--muted)' }}>
          ← Home
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <GuideTOC
          sections={guide.sections}
          activeSection={activeSection}
          onSectionClick={scrollToSection}
          mobileOpen={mobileSheet === 'toc'}
          onMobileClose={() => setMobileSheet(null)}
        />

        <GuideContent
          sections={guide.sections}
          guideId={guide.id}
          contentRef={contentRef}
        />

        <GuideChatPanel
          guide={guide}
          mobileOpen={mobileSheet === 'chat'}
          onMobileClose={() => setMobileSheet(null)}
        />
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--background)', paddingBottom: 'env(safe-area-inset-bottom)' }}
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
    </div>
  )
}
```

- [ ] **Step 2: Update GuideView tests**

Replace the entire `__tests__/GuideView.test.tsx` with:

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuideView from '@/app/guide/[id]/GuideView'
import type { Guide } from '@/types/guide'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

jest.mock('@/components/guide/GuideTOC', () => ({
  GuideTOC: ({ sections, mobileOpen, onMobileClose }: { sections: { id: string; heading: string }[], mobileOpen: boolean, onMobileClose: () => void }) => (
    mobileOpen ? (
      <div>
        <h2>Contents</h2>
        <div data-testid="mobile-toc-section-list">
          {sections.map((s, i) => (
            <a key={s.id} href={`#section-${s.id}`} onClick={onMobileClose}>{i + 1}. {s.heading}</a>
          ))}
        </div>
        <button onClick={onMobileClose} aria-label="Close contents" />
      </div>
    ) : null
  ),
}))

jest.mock('@/components/guide/GuideChatPanel', () => ({
  GuideChatPanel: ({ mobileOpen, onMobileClose }: { mobileOpen: boolean, onMobileClose: () => void }) => (
    mobileOpen ? (
      <div>
        <h2>Ask</h2>
        <div data-testid="mobile-chat-sheet">
          <input placeholder="Ask…" />
        </div>
        <div data-testid="chat-sheet-backdrop" onClick={onMobileClose} />
      </div>
    ) : null
  ),
}))

jest.mock('@/components/guide/GuideContent', () => ({
  GuideContent: () => <div data-testid="guide-content" />,
}))

jest.mock('@/hooks/useGuideScroll', () => ({
  useGuideScroll: (sections: { id: string }[]) => ({
    activeSection: sections[0]?.id ?? '',
    contentRef: { current: null },
    scrollToSection: jest.fn(),
  }),
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

  it('opens the TOC sheet when Contents is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /contents/i }))
    expect(screen.getByRole('heading', { name: /contents/i })).toBeInTheDocument()
    const sheet = screen.getByTestId('mobile-toc-section-list')
    expect(within(sheet).getByText('1. Introduction')).toBeInTheDocument()
    expect(within(sheet).getByText('2. Chapter Two')).toBeInTheDocument()
  })

  it('closes the TOC sheet when a section link is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /contents/i }))
    await user.click(within(screen.getByTestId('mobile-toc-section-list')).getByText('1. Introduction'))
    expect(screen.queryByRole('heading', { name: /contents/i })).not.toBeInTheDocument()
  })

  it('closes the TOC sheet when Guide button is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /contents/i }))
    await user.click(screen.getByRole('button', { name: /guide/i }))
    expect(screen.queryByRole('heading', { name: /contents/i })).not.toBeInTheDocument()
  })

  it('opens the chat sheet when Chat is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /^chat$/i }))
    expect(screen.getByRole('heading', { name: /^ask$/i })).toBeInTheDocument()
    expect(within(screen.getByTestId('mobile-chat-sheet')).getByPlaceholderText(/ask…/i)).toBeInTheDocument()
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
    await user.click(screen.getByTestId('chat-sheet-backdrop'))
    expect(screen.queryByRole('heading', { name: /^ask$/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run all tests — verify they pass**

```bash
npx jest --no-coverage
```
Expected: all tests PASS

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/guide/[id]/GuideView.tsx __tests__/GuideView.test.tsx
git commit -m "refactor: shrink GuideView to thin orchestrator using extracted hooks and components"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: all tests PASS

- [ ] **Step 2: Check line counts meet spec targets**

```bash
wc -l app/guide/\[id\]/GuideView.tsx components/GuideElement.tsx
```
Expected: `GuideView.tsx` under 150 lines, `GuideElement.tsx` under 100 lines

- [ ] **Step 3: TypeScript clean build**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: complete parallel agent refactor — GuideView and GuideElement split into focused files"
```
