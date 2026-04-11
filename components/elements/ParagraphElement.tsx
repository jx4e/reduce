// components/elements/ParagraphElement.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import type { ContentElement } from '@/types/guide'

export function ParagraphElement({ element }: { element: ContentElement }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <p className="text-sm leading-7" style={{ color: 'var(--foreground)' }}>{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
          <code className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: 'var(--border)' }}>{children}</code>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse" style={{ borderColor: 'var(--border)' }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr style={{ borderBottom: '1px solid var(--border)' }}>{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold" style={{ background: 'var(--surface)', color: 'var(--foreground)', borderBottom: '2px solid var(--border)' }}>{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-xs" style={{ color: 'var(--foreground)' }}>{children}</td>
        ),
      }}
    >
      {element.content}
    </ReactMarkdown>
  )
}
