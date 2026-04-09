'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import GuideElement from '@/components/GuideElement'
import type { Guide, ChatMessage, ContentElement } from '@/types/guide'
import type { ChatRequestBody, ChatEvent } from '@/app/api/guides/[id]/chat/route'

let msgIdCounter = 0
function nextId() { return `msg-${++msgIdCounter}` }

async function streamChat(
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

export default function GuideView({ guide }: { guide: Guide }) {
  const [elementChats, setElementChats] = useState<Map<string, ChatMessage[]>>(new Map())
  const [elementNotes, setElementNotes] = useState<Map<string, string>>(new Map())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [contextElement, setContextElement] = useState<ContentElement | undefined>()
  const [activeSection, setActiveSection] = useState<string>(guide.sections[0]?.id ?? '')
  const [globalLoading, setGlobalLoading] = useState(false)
  const [loadingElementId, setLoadingElementId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const context: ChatRequestBody['context'] = {
    guideTitle: guide.title,
    sectionHeadings: guide.sections.map(s => s.heading),
  }

  // Initialise active section from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#section-')) {
      const sectionId = hash.slice('#section-'.length)
      if (guide.sections.some(s => s.id === sectionId)) {
        setActiveSection(sectionId)
        document.getElementById(`section-${sectionId}`)?.scrollIntoView()
      }
    }
  }, [])

  // Track which section is in view
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    function updateActive() {
      const { scrollTop, clientHeight, scrollHeight } = scrollEl!
      if (scrollTop + clientHeight >= scrollHeight - 4) {
        setActiveSection(guide.sections[guide.sections.length - 1]?.id ?? '')
        return
      }
      const threshold = clientHeight * 0.25
      let active = guide.sections[0]?.id ?? ''
      for (const section of guide.sections) {
        const el = scrollEl!.querySelector(`#section-${section.id}`) as HTMLElement | null
        if (el && el.offsetTop - scrollTop <= threshold) active = section.id
      }
      setActiveSection(active)
    }
    scrollEl.addEventListener('scroll', updateActive, { passive: true })
    return () => scrollEl.removeEventListener('scroll', updateActive)
  }, [guide.sections])

  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const askInputRef = useRef<HTMLInputElement>(null)

  async function handleAsk(element: ContentElement, question: string) {
    if (loadingElementId) return
    setLoadingElementId(element.id)

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: question }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }

    setElementChats(prev => {
      const next = new Map(prev)
      next.set(element.id, [...(next.get(element.id) ?? []), userMsg, assistantMsg])
      return next
    })

    const history = [...(elementChats.get(element.id) ?? []), userMsg]

    try {
      await streamChat(
        guide.id,
        {
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context: { ...context, element: { type: element.type, content: element.content } },
        },
        (chunk) => {
          setElementChats(prev => {
            const next = new Map(prev)
            const msgs = next.get(element.id) ?? []
            next.set(element.id, msgs.map(m =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            ))
            return next
          })
        },
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      setElementChats(prev => {
        const next = new Map(prev)
        const msgs = next.get(element.id) ?? []
        next.set(element.id, msgs.map(m =>
          m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m
        ))
        return next
      })
    } finally {
      setLoadingElementId(null)
    }
  }

  function handleNoteChange(elementId: string, note: string) {
    setElementNotes(prev => new Map(prev).set(elementId, note))
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || globalLoading) return

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: input.trim(),
      contextElementId: contextElement?.id,
      contextElementContent: contextElement?.content,
    }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }

    const newMessages = [...messages, userMsg, assistantMsg]
    setMessages(newMessages)
    setInput('')
    setContextElement(undefined)
    setGlobalLoading(true)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const requestContext: ChatRequestBody['context'] = contextElement
      ? { ...context, element: { type: contextElement.type, content: contextElement.content } }
      : context

    const history = [...messages, userMsg]

    abortRef.current = new AbortController()
    try {
      await streamChat(
        guide.id,
        {
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context: requestContext,
        },
        (chunk) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          ))
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
        abortRef.current.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m
      ))
    } finally {
      setGlobalLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Guide header */}
      <div className="border-b px-6 py-3 flex items-center justify-between shrink-0"
           style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-semibold truncate">{guide.title}</h1>
        <Link href="/" className="text-sm transition-colors" style={{ color: 'var(--muted)' }}>
          ← Home
        </Link>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* TOC Sidebar */}
        <aside
          className="hidden md:flex w-52 shrink-0 flex-col gap-1 border-r px-4 py-6 overflow-y-auto"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            Contents
          </p>
          {guide.sections.map((section, i) => {
            const isActive = activeSection === section.id
            return (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                onClick={() => setActiveSection(section.id)}
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
        </aside>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollBehavior: 'smooth' }}>
          <div className="max-w-2xl mx-auto flex flex-col gap-8">
            {guide.sections.map(section => (
              <section key={section.id} id={`section-${section.id}`}>
                <h2 className="text-lg font-semibold mb-4">{section.heading}</h2>
                <div className="flex flex-col gap-2">
                  {section.elements.map(element => (
                    <GuideElement
                      key={element.id}
                      element={element}
                      messages={elementChats.get(element.id) ?? []}
                      note={elementNotes.get(element.id) ?? ''}
                      loading={loadingElementId === element.id}
                      onAsk={handleAsk}
                      onNoteChange={handleNoteChange}
                    />
                  ))}
                </div>
              </section>
            ))}
            <div className="h-[75vh]" aria-hidden="true" />
          </div>
        </div>

        {/* Ask pane (right) */}
        <aside
          className="hidden md:flex w-72 shrink-0 flex-col border-l"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Ask</p>
          </div>

          <div role="log" className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--muted-dark)' }}>
                Ask anything about this guide, or right-click any element to ask about it specifically.
              </p>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.contextElementContent && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                    re: {msg.contextElementContent.slice(0, 35)}…
                  </span>
                )}
                <div
                  className="max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                  style={{
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                    color: msg.role === 'user' ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {msg.content || (msg.role === 'assistant' && <TypingDots />)}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSend} className="shrink-0 border-t px-3 py-3 flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
            {contextElement && (
              <div className="flex items-center justify-between rounded px-2 py-1 text-xs" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                <span className="truncate">re: {contextElement.content.slice(0, 40)}</span>
                <button type="button" onClick={() => setContextElement(undefined)} className="ml-2 shrink-0">×</button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={askInputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask anything…"
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: 'var(--foreground)' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || globalLoading}
                className="text-sm font-semibold disabled:opacity-30 transition-opacity"
                style={{ color: 'var(--accent)' }}
              >
                {globalLoading ? '…' : '→'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center" aria-label="Typing">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 4, height: 4,
            background: 'var(--muted)',
            animation: `loading-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  )
}
