'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import GuideElement from '@/components/GuideElement'
import AskBar from '@/components/AskBar'
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

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id.replace('section-', ''))
        }
      },
      {
        root: scrollEl,
        // Fire when top 40% of scroll area is crossed — feels responsive without being jumpy
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      }
    )

    guide.sections.forEach(section => {
      const el = scrollEl.querySelector(`#section-${section.id}`)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [guide.sections])

  function handleAsk(element: ContentElement, question: string) {
    handleSend(question, element)
  }

  function handleSend(question: string, ctx?: ContentElement) {
    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: question,
      contextElementId: ctx?.id,
      contextElementContent: ctx?.content,
    }
    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: `(Simulated response to: "${question}")`,
    }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setContextElement(undefined)
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

        {/* Scrollable content — ref used by IntersectionObserver */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 pb-4">
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
          </div>
        </div>
      </div>

      {/* Always-visible ask bar */}
      <div className="sticky bottom-0">
        <AskBar
          messages={messages}
          onSend={handleSend}
          contextElement={contextElement}
          onClearContext={() => setContextElement(undefined)}
        />
      </div>
    </div>
  )
}
