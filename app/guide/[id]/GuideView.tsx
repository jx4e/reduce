'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import GuideElement, { MarkdownMessage } from '@/components/GuideElement'
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
  const [activeSection, setActiveSection] = useState<string>(guide.sections[0]?.id ?? '')
  const [loadingElementId, setLoadingElementId] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [guideMessages, setGuideMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatWidth, setChatWidth] = useState(300)
  const [mobileSheet, setMobileSheet] = useState<'toc' | 'chat' | null>(null)
  const chatDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const [isChatDragging, setIsChatDragging] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const MIN_CHAT_WIDTH = 220
  const MAX_CHAT_WIDTH = 560

  const context: ChatRequestBody['context'] = {
    guideTitle: guide.title,
    sectionHeadings: guide.sections.map(s => s.heading),
  }

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

  function onChatDragPointerDown(e: React.PointerEvent) {
    chatDragRef.current = { startX: e.clientX, startW: chatWidth }
    setIsChatDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onChatDragPointerMove(e: React.PointerEvent) {
    if (!chatDragRef.current) return
    const delta = chatDragRef.current.startX - e.clientX
    setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, chatDragRef.current.startW + delta)))
  }

  function onChatDragPointerUp() {
    chatDragRef.current = null
    setIsChatDragging(false)
  }

  async function handleGuideChatSend() {
    const q = chatInput.trim()
    if (!q || chatLoading) return
    setChatInput('')
    setChatLoading(true)

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: q }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }
    setGuideMessages(prev => [...prev, userMsg, assistantMsg])

    const history = [...guideMessages, userMsg]

    try {
      await streamChat(
        guide.id,
        { messages: history.map(m => ({ role: m.role, content: m.content })), context },
        (chunk) => {
          setGuideMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          )
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      setGuideMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m)
      )
    } finally {
      setChatLoading(false)
      setTimeout(() => chatInputRef.current?.focus(), 50)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0"
           style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-semibold truncate flex-1">{guide.title}</h1>
        <Link href="/" className="text-sm transition-colors shrink-0" style={{ color: 'var(--muted)' }}>
          ← Home
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Floating hamburger — only when sidebar is closed */}
        {!tocOpen && (
          <button
            onClick={() => setTocOpen(true)}
            title="Show sidebar"
            className="absolute top-3 left-3 z-10 hidden md:flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
            style={{ background: 'var(--border)', color: 'var(--foreground)' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 3.5h11M2 7.5h7M2 11.5h9" />
            </svg>
          </button>
        )}

        {/* TOC Sidebar — always rendered, width animates open/closed */}
        <aside
          className="hidden md:flex shrink-0 flex-col border-r overflow-hidden relative transition-all duration-300 ease-in-out"
          style={{ width: tocOpen ? '13rem' : '0', borderColor: 'var(--border)' }}
        >
          <div className="w-52 flex flex-col gap-1 px-4 py-6 flex-1 overflow-y-auto">
            <button
              onClick={() => setTocOpen(false)}
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
          </div>
        </aside>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 pb-20 md:pb-6" style={{ scrollBehavior: 'smooth' }}>
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

        {/* Floating chat button — only when sidebar is closed */}
        {!chatOpen && (
          <button
            onClick={() => { setChatOpen(true); setTimeout(() => chatInputRef.current?.focus(), 50) }}
            title="Toggle ask panel"
            className="absolute bottom-3 right-3 z-10 hidden md:flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
            style={{ background: 'var(--border)', color: 'var(--foreground)' }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2.5V3a1 1 0 0 1 1-1z" />
            </svg>
          </button>
        )}

        {/* Chat Sidebar — always rendered, width animates open/closed */}
        <aside
          className="hidden md:flex shrink-0 flex-col border-l overflow-hidden relative"
          style={{
            width: chatOpen ? `${chatWidth}px` : '0',
            borderColor: 'var(--border)',
            transition: isChatDragging ? 'none' : 'width 300ms ease-in-out',
          }}
        >
          {/* Drag handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-400 hover:opacity-40 transition-opacity"
            onPointerDown={onChatDragPointerDown}
            onPointerMove={onChatDragPointerMove}
            onPointerUp={onChatDragPointerUp}
          />

          <div className="flex flex-col h-full" style={{ width: chatWidth }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Ask</p>
              <button
                onClick={() => setChatOpen(false)}
                title="Close ask panel"
                className="flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
                style={{ background: 'transparent', color: 'var(--muted)' }}
              >
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
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
                      : msg.content
                    }
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
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGuideChatSend() } }}
                  placeholder="Ask…"
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: 'var(--foreground)' }}
                />
                <button
                  onClick={handleGuideChatSend}
                  disabled={!chatInput.trim() || chatLoading}
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
        </aside>

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
              <div data-testid="mobile-toc-sheet" className="overflow-y-auto flex flex-col gap-1 px-4 py-4">
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
      </div>

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
    </div>
  )
}
