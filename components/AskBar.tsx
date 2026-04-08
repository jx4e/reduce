'use client'

import { useRef, useState } from 'react'
import type { ChatMessage, ContentElement } from '@/types/guide'

interface AskBarProps {
  messages: ChatMessage[]
  onSend: (question: string, contextElement?: ContentElement) => void
  contextElement?: ContentElement
  onClearContext?: () => void
}

export default function AskBar({ messages, onSend, contextElement, onClearContext }: AskBarProps) {
  const [input, setInput] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input.trim(), contextElement)
    setInput('')
  }

  return (
    <div
      className="border-t"
      style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      {/* Chat history drawer */}
      {hasMessages && (
        <div
          role="log"
          ref={logRef}
          className="max-h-72 overflow-y-auto px-6 py-4 flex flex-col gap-3"
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.contextElementContent && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                  re: {msg.contextElementContent.slice(0, 40)}…
                </span>
              )}
              <div
                className="max-w-[80%] rounded-xl px-3 py-2 text-sm"
                style={{
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                  color: msg.role === 'user' ? '#fff' : 'var(--foreground)',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-6 py-3">
        {/* Context tag */}
        {contextElement && (
          <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs shrink-0"
               style={{ background: 'var(--border)', color: 'var(--muted)' }}>
            <span>re: {contextElement.content.slice(0, 30)}{contextElement.content.length > 30 ? '…' : ''}</span>
            {onClearContext && (
              <button type="button" onClick={onClearContext} aria-label="Clear context">×</button>
            )}
          </div>
        )}

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about this guide…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
        <button
          type="submit"
          className="text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
          disabled={!input.trim()}
        >
          →
        </button>
      </form>
    </div>
  )
}
