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
        {desktopOpen && (
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
        )}
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
