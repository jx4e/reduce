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
  const [activeSection, setActiveSection] = useState<string>(guide.sections[0]?.id ?? '')
  const [loadingElementId, setLoadingElementId] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0"
           style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setTocOpen(v => !v)}
          title={tocOpen ? 'Hide contents' : 'Show contents'}
          className="hidden md:flex items-center justify-center rounded p-1.5 transition-colors shrink-0"
          style={{
            color: tocOpen ? 'var(--foreground)' : 'var(--muted)',
            background: tocOpen ? 'var(--border)' : 'transparent',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 3.5h11M2 7.5h7M2 11.5h9" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold truncate flex-1">{guide.title}</h1>
        <Link href="/" className="text-sm transition-colors shrink-0" style={{ color: 'var(--muted)' }}>
          ← Home
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* TOC Sidebar */}
        {tocOpen && (
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
        )}

        {/* Content */}
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
      </div>
    </div>
  )
}
