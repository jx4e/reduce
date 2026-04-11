// components/elements/CodeElement.tsx
'use client'

import { useState } from 'react'
import hljs from 'highlight.js'
import type { ContentElement } from '@/types/guide'

export function CodeElement({ element }: { element: ContentElement }) {
  const [copied, setCopied] = useState(false)
  const { content, language } = element

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
