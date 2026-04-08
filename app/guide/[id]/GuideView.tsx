'use client'

import { useState } from 'react'
import Link from 'next/link'
import GuideElement from '@/components/GuideElement'
import AskBar from '@/components/AskBar'
import type { Guide, ChatMessage, ContentElement } from '@/types/guide'

let msgIdCounter = 0
function nextId() { return `msg-${++msgIdCounter}` }

export default function GuideView({ guide }: { guide: Guide }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [contextElement, setContextElement] = useState<ContentElement | undefined>()

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
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      {/* Guide header */}
      <div className="border-b px-6 py-3 flex items-center justify-between"
           style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-semibold truncate">{guide.title}</h1>
        <Link href="/" className="text-sm transition-colors"
              style={{ color: 'var(--muted)' }}>
          ← Home
        </Link>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* TOC Sidebar */}
        <aside className="hidden md:flex w-52 shrink-0 flex-col gap-1 border-r px-4 py-6 overflow-y-auto sticky top-14"
               style={{ borderColor: 'var(--border)', maxHeight: 'calc(100vh - 3.5rem - 2.5rem)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
             style={{ color: 'var(--muted)' }}>
            Contents
          </p>
          {guide.sections.map((section, i) => (
            <a
              key={section.id}
              href={`#section-${section.id}`}
              className="text-xs py-1 transition-colors hover:opacity-80"
              style={{ color: 'var(--muted)' }}
            >
              {i + 1}. {section.heading}
            </a>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-4">
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
