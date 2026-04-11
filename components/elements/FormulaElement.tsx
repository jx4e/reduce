// components/elements/FormulaElement.tsx
'use client'

import katex from 'katex'
import type { ContentElement } from '@/types/guide'

export function FormulaElement({ element }: { element: ContentElement }) {
  let html: string
  try {
    html = katex.renderToString(element.content, { displayMode: true, throwOnError: false })
  } catch {
    html = element.content
  }
  return (
    <div
      className="my-3 overflow-x-auto rounded-md px-4 py-3"
      style={{ background: 'var(--surface)', borderLeft: '3px solid var(--accent)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
