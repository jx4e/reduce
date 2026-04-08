'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import GuideElement from '@/components/GuideElement'
import type { Guide, ChatMessage, ContentElement } from '@/types/guide'

let msgIdCounter = 0
function nextId() { return `msg-${++msgIdCounter}` }

export default function GuideView({ guide }: { guide: Guide }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [contextElement, setContextElement] = useState<ContentElement | undefined>()
  const [activeSection, setActiveSection] = useState<string>(guide.sections[0]?.id ?? '')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Track which section is in view using IntersectionObserver on the scroll container
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    function updateActive() {
      const { scrollTop, clientHeight, scrollHeight } = scrollEl!

      // At the bottom — last section wins regardless of its size
      if (scrollTop + clientHeight >= scrollHeight - 4) {
        setActiveSection(guide.sections[guide.sections.length - 1]?.id ?? '')
        return
      }

      const threshold = clientHeight * 0.25
      let active = guide.sections[0]?.id ?? ''
      for (const section of guide.sections) {
        const el = scrollEl!.querySelector(`#section-${section.id}`) as HTMLElement | null
        if (el && el.offsetTop - scrollTop <= threshold) {
          active = section.id
        }
      }
      setActiveSection(active)
    }

    scrollEl.addEventListener('scroll', updateActive, { passive: true })
    return () => scrollEl.removeEventListener('scroll', updateActive)
  }, [guide.sections])

  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  function handleAsk(element: ContentElement, question: string) {
    // Pre-fill the pane input with context so the user can edit before sending
    setContextElement(element)
    setInput(question)
    askInputRef.current?.focus()
  }

  const askInputRef = useRef<HTMLInputElement>(null)

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: input.trim(),
      contextElementId: contextElement?.id,
      contextElementContent: contextElement?.content,
    }
    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: `(Simulated response to: "${input.trim()}")`,
    }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setContextElement(undefined)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Guide header */}
      <div className="border-b px-6 py-3 flex items-center justify-between shrink-0"
           style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-semibold truncate">{guide.title}</h1>
        <Link href="/" className="text-sm transition-colors"
              style={{ color: 'var(--muted)' }}>
          ← Home
        </Link>
      </div>

      {/* Main content area — min-h-0 lets this shrink so overflow-hidden actually clips */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* TOC Sidebar — fills the full height of the flex container, stays pinned */}
        <aside
          className="hidden md:flex w-52 shrink-0 flex-col gap-1 border-r px-4 py-6 overflow-y-auto"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
             style={{ color: 'var(--muted)' }}>
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-8">
            {guide.sections.map(section => (
              <section key={section.id} id={`section-${section.id}`}>
                <h2 className="text-lg font-semibold mb-4">{section.heading}</h2>
                <div className="flex flex-col gap-2">
                  {section.elements.map(element => (
                    <GuideElement
                      key={element.id}
                      element={element}
                      onAsk={handleAsk}
                    />
                  ))}
                </div>
              </section>
            ))}
            {/* Spacer so the last section can always scroll past the highlight threshold */}
            <div className="h-[75vh]" aria-hidden="true" />
          </div>
        </div>

        {/* Ask pane (right) */}
        <aside
          className="hidden md:flex w-72 shrink-0 flex-col border-l"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Pane header */}
          <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Ask
            </p>
          </div>

          {/* Chat history */}
          <div role="log" className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--muted-dark)' }}>
                Ask anything about this guide, or click <strong>?</strong> on any element to ask about it specifically.
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
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
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
                disabled={!input.trim()}
                className="text-sm font-semibold disabled:opacity-30 transition-opacity"
                style={{ color: 'var(--accent)' }}
              >
                →
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}
