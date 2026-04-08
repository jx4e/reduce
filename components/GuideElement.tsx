'use client'

import { useState, useRef } from 'react'
import katex from 'katex'
import hljs from 'highlight.js'
import type { ContentElement } from '@/types/guide'

interface GuideElementProps {
  element: ContentElement
  onAsk: (element: ContentElement, question: string) => void
}

export default function GuideElement({ element, onAsk }: GuideElementProps) {
  const [hovered, setHovered] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function openPopover() {
    setPopoverOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = question.trim() || 'What does this mean?'
    onAsk(element, text)
    setQuestion('')
    setPopoverOpen(false)
  }

  return (
    <div
      data-testid={`guide-element-${element.id}`}
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false) }}
    >
      {/* Content — subtle ring when modal is open so user knows what they clicked */}
      <div
        className="py-1 rounded transition-all"
        style={popoverOpen ? { outline: '1px solid var(--accent)', outlineOffset: '3px' } : {}}
      >
        <ElementContent element={element} />
      </div>

      {/* Hover ask button */}
      <button
        aria-label="Ask about this"
        onClick={openPopover}
        className="absolute right-0 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-opacity"
        style={{
          background: 'var(--accent)',
          color: '#fff',
          visibility: hovered && !popoverOpen ? 'visible' : 'hidden',
        }}
      >
        ?
      </button>

      {/* Modal overlay — blurred backdrop, element shown in full */}
      {popoverOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setPopoverOpen(false) }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {/* Element preview */}
            <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <ElementContent element={element} />
            </div>

            {/* Ask form */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-4">
              <input
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="What does this mean?"
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
                onKeyDown={e => { if (e.key === 'Escape') setPopoverOpen(false) }}
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
