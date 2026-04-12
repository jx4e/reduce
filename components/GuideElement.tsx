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

  const menuItems = [
    { label: 'Ask about this', icon: 'M14 1H2C1.45 1 1 1.45 1 2v9c0 .55.45 1 1 1h2v3l3.5-3H14c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1z', action: () => { setCtxMenu(null); openModal('chat') } },
    { label: 'Add note', icon: 'M13 1H3a2 2 0 0 0-2 2v12l3-3h9a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm-1 9H4V9h8v1zm0-3H4V6h8v1zm0-3H4V3h8v1z', action: () => { setCtxMenu(null); openModal('notes') } },
    ...(['paragraph', 'heading', 'formula', 'code'] as const).includes(element.type as 'paragraph' | 'heading' | 'formula' | 'code')
      ? [{ label: 'Copy text', icon: 'M10 1H4a1 1 0 0 0-1 1v1H2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1h1a1 1 0 0 0 1-1V5l-4-4zm0 1.5L12.5 5H10V2.5zM10 13H2V4h1v8a1 1 0 0 0 1 1h6v1zm3-3H4V2h5v4h4v7z', action: () => { setCtxMenu(null); navigator.clipboard.writeText(element.content) } }]
      : [],
  ]

  return (
    <div
      data-testid={`guide-element-${element.id}`}
      className="relative"
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onClick={e => { if (e.metaKey) { e.preventDefault(); openModal('chat') } }}
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
          {menuItems.map(item => (
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
