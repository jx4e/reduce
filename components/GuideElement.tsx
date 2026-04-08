'use client'

import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import hljs from 'highlight.js'
import type { ChatMessage, ContentElement, TimelineEvent } from '@/types/guide'

interface GuideElementProps {
  element: ContentElement
  messages: ChatMessage[]
  note: string
  onAsk: (element: ContentElement, question: string) => void
  onNoteChange: (elementId: string, note: string) => void
}

export default function GuideElement({ element, messages, note, onAsk, onNoteChange }: GuideElementProps) {
  const [hovered, setHovered] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat')
  const [question, setQuestion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  function openModal() {
    setModalOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function closeModal() {
    setModalOpen(false)
    setHovered(false)
  }

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (modalOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, modalOpen])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = question.trim() || 'What does this mean?'
    onAsk(element, text)
    setQuestion('')
  }

  const hasPriorMessages = messages.length > 0

  return (
    <div
      data-testid={`guide-element-${element.id}`}
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Content — subtle ring when modal is open */}
      <div
        className="py-1 rounded transition-all"
        style={modalOpen ? { outline: '1px solid var(--accent)', outlineOffset: '3px' } : {}}
      >
        <ElementContent element={element} />
      </div>

      {/* Ask button — dot badge when prior messages exist */}
      <button
        aria-label="Ask about this"
        onClick={openModal}
        className="absolute right-0 top-1 flex items-center justify-center rounded-full text-xs font-bold transition-all"
        style={{
          width: hasPriorMessages ? '1.75rem' : '1.5rem',
          height: hasPriorMessages ? '1.75rem' : '1.5rem',
          background: hasPriorMessages ? 'var(--accent)' : 'var(--accent)',
          color: '#fff',
          visibility: hovered && !modalOpen ? 'visible' : 'hidden',
          boxShadow: hasPriorMessages ? '0 0 0 2px rgba(99,102,241,0.35)' : 'none',
        }}
      >
        {hasPriorMessages ? messages.length : '?'}
      </button>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', animation: 'fade-in 0.15s ease-out' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '80vh', animation: 'modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            {/* Element preview */}
            <div className="px-6 pt-5 pb-4 border-b overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: '40%' }}>
              <ElementContent element={element} />
            </div>

            {/* Tab bar */}
            <div className="flex shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              {(['chat', 'notes'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-5 py-2.5 text-xs font-semibold capitalize transition-colors"
                  style={{
                    color: activeTab === tab ? 'var(--foreground)' : 'var(--muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  {tab}
                  {tab === 'chat' && messages.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {messages.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Chat tab */}
            {activeTab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
                  {messages.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Ask anything about this — your conversation stays here.
                    </p>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed"
                        style={{
                          background: msg.role === 'user' ? 'var(--accent)' : 'var(--background)',
                          color: msg.role === 'user' ? '#fff' : 'var(--foreground)',
                          border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form
                  onSubmit={handleSubmit}
                  className="shrink-0 border-t flex items-center gap-3 px-4 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <input
                    ref={inputRef}
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="What does this mean?"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    onKeyDown={e => { if (e.key === 'Escape') closeModal() }}
                  />
                  <button
                    type="submit"
                    aria-label="Submit question"
                    className="rounded-lg px-4 py-2 text-sm font-semibold shrink-0"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    Ask →
                  </button>
                </form>
              </>
            )}

            {/* Notes tab */}
            {activeTab === 'notes' && (
              <div className="flex-1 flex flex-col min-h-0 px-5 py-4">
                <textarea
                  aria-label="Notes"
                  value={note}
                  onChange={e => onNoteChange(element.id, e.target.value)}
                  placeholder="Jot down anything about this…"
                  className="flex-1 resize-none rounded-lg border p-3 text-sm leading-relaxed outline-none"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  onKeyDown={e => { if (e.key === 'Escape') closeModal() }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ElementContent({ element }: { element: ContentElement }) {
  switch (element.type) {
    case 'heading':
      return element.level === 3
        ? <h3 className="text-base font-semibold mt-4 mb-1">{element.content}</h3>
        : <h2 className="text-lg font-semibold mt-6 mb-2">{element.content}</h2>
    case 'paragraph':
      return <p className="text-sm leading-7" style={{ color: 'var(--foreground)' }}>{element.content}</p>
    case 'formula':
      return <FormulaBlock content={element.content} />
    case 'code':
      return <CodeBlock content={element.content} language={element.language} />
    case 'image':
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
    case 'timeline':
      return <TimelineBlock events={element.events ?? []} />
  }
}

function CodeBlock({ content, language }: { content: string; language?: string }) {
  let html: string
  try {
    html = language && hljs.getLanguage(language)
      ? hljs.highlight(content, { language }).value
      : hljs.highlightAuto(content).value
  } catch {
    html = content
  }
  return (
    <pre className="my-3 overflow-x-auto rounded-md text-sm" style={{ background: 'var(--surface)' }}>
      <code
        className={language ? `language-${language}` : ''}
        style={{ display: 'block', padding: '0.75rem 1rem' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  )
}

function TimelineBlock({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="my-3 flex flex-col" style={{ paddingLeft: '1rem' }}>
      {events.map((event, i) => (
        <div key={i} className="relative flex gap-4" style={{ paddingBottom: i < events.length - 1 ? '1.5rem' : 0 }}>
          {/* Vertical line + dot */}
          <div className="flex flex-col items-center shrink-0" style={{ width: '1rem' }}>
            <div className="rounded-full shrink-0" style={{ width: '0.5rem', height: '0.5rem', marginTop: '0.35rem', background: 'var(--accent)' }} />
            {i < events.length - 1 && (
              <div className="flex-1 mt-1" style={{ width: '1px', background: 'var(--border)' }} />
            )}
          </div>
          {/* Content */}
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

function FormulaBlock({ content }: { content: string }) {
  let html: string
  try {
    html = katex.renderToString(content, { displayMode: true, throwOnError: false })
  } catch {
    html = content
  }
  return (
    <div
      className="my-3 overflow-x-auto rounded-md px-4 py-3"
      style={{ background: 'var(--surface)', borderLeft: '3px solid var(--accent)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
