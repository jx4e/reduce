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
      {/* Content — highlighted when popover is open */}
      <div
        className="py-1 rounded transition-colors"
        style={popoverOpen ? { background: 'rgba(99,102,241,0.12)', outline: '1px solid var(--accent)', outlineOffset: '2px' } : {}}
      >
        <ElementContent element={element} />
      </div>

      {/* Hover ask button — always rendered, visibility controlled by CSS so it stays in DOM during click */}
      {!popoverOpen && (
        <button
          aria-label="Ask about this"
          onClick={openPopover}
          className="absolute right-0 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-opacity"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            visibility: hovered ? 'visible' : 'hidden',
          }}
        >
          ?
        </button>
      )}

      {/* Contextual popover */}
      {popoverOpen && (
        <div
          className="absolute left-0 right-0 z-20 mt-1 rounded-lg border p-3 shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="What does this mean?"
              className="flex-1 rounded-md border px-3 py-1.5 text-sm outline-none"
              style={{
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <button
              type="submit"
              aria-label="Submit question"
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Ask &rarr;
            </button>
          </form>
          <button
            onClick={() => setPopoverOpen(false)}
            className="mt-1 text-xs"
            style={{ color: 'var(--muted)' }}
          >
            Cancel
          </button>
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
