'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import katex from 'katex'
import hljs from 'highlight.js'
import type { ChatMessage, ContentElement, TimelineEvent } from '@/types/guide'

interface GuideElementProps {
  element: ContentElement
  messages: ChatMessage[]
  note: string
  loading?: boolean
  onAsk: (element: ContentElement, question: string) => void
  onNoteChange: (elementId: string, note: string) => void
}

export default function GuideElement({ element, messages, note, loading, onAsk, onNoteChange }: GuideElementProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [question, setQuestion] = useState('')
  const [previewHeight, setPreviewHeight] = useState(380)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startY: number; startH: number } | null>(null)

  function onDragPointerDown(e: React.PointerEvent) {
    dragState.current = { startY: e.clientY, startH: previewHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onDragPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return
    const delta = e.clientY - dragState.current.startY
    const modalH = modalRef.current?.offsetHeight ?? 480
    const next = Math.min(Math.max(60, dragState.current.startH + delta), modalH * 0.72)
    setPreviewHeight(next)
  }

  function onDragPointerUp() {
    dragState.current = null
  }

  function openModal(tab: 'chat' | 'notes' = 'chat') {
    setActiveTab(tab)
    setModalOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function closeModal() {
    setModalOpen(false)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

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

  return (
    <div
      data-testid={`guide-element-${element.id}`}
      className="relative"
      onContextMenu={handleContextMenu}
    >
      {/* Content — subtle ring when modal is open */}
      <div
        className="py-1 rounded transition-all"
        style={modalOpen ? { outline: '1px solid var(--accent)', outlineOffset: '3px' } : {}}
      >
        <ElementContent element={element} />
      </div>

      {/* Context menu */}
      {ctxMenu && createPortal(
        <div
          className="fixed z-[9999] rounded-lg border shadow-xl overflow-hidden"
          style={{
            top: ctxMenu.y,
            left: ctxMenu.x,
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            minWidth: '11rem',
            animation: 'fade-in 0.1s ease-out',
          }}
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: 'Ask about this', icon: 'M14 1H2C1.45 1 1 1.45 1 2v9c0 .55.45 1 1 1h2v3l3.5-3H14c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1z', action: () => { setCtxMenu(null); openModal('chat') } },
            { label: 'Add note',        icon: 'M13 1H3a2 2 0 0 0-2 2v12l3-3h9a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm-1 9H4V9h8v1zm0-3H4V6h8v1zm0-3H4V3h8v1z', action: () => { setCtxMenu(null); openModal('notes') } },
            { label: 'Copy text',       icon: 'M10 1H4a1 1 0 0 0-1 1v1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1h1a1 1 0 0 0 1-1V5l-4-4zm0 1.5L12.5 5H10V2.5zM10 13H2V4h1v8a1 1 0 0 0 1 1h6v1zm3-3H4V2h5v4h4v7z', action: () => { setCtxMenu(null); navigator.clipboard.writeText(element.content) } },
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

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', animation: 'fade-in 0.15s ease-out' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '80vh', animation: 'modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            {/* Element preview */}
            <div className="px-6 pt-5 pb-4 overflow-y-auto shrink-0" style={{ height: previewHeight }}>
              <ElementContent element={element} />
            </div>

            {/* Drag handle */}
            <div
              className="shrink-0 flex items-center justify-center border-y cursor-row-resize select-none"
              style={{ height: '12px', borderColor: 'var(--border)', background: 'var(--background)' }}
              onPointerDown={onDragPointerDown}
              onPointerMove={onDragPointerMove}
              onPointerUp={onDragPointerUp}
            >
              <div className="rounded-full" style={{ width: '2rem', height: '3px', background: 'var(--border-hover)' }} />
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
                        {msg.role === 'assistant'
                          ? <MarkdownMessage content={msg.content} />
                          : msg.content}
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
                    disabled={loading}
                    className="rounded-lg px-4 py-2 text-sm font-semibold shrink-0 disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {loading ? '…' : 'Ask →'}
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

function MarkdownMessage({ content }: { content: string }) {
  if (!content) return null
  return (
    <ReactMarkdown
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
      }}
    >
      {content}
    </ReactMarkdown>
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
  const [copied, setCopied] = useState(false)

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
