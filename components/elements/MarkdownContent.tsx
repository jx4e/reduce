// components/elements/MarkdownContent.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'

export function MarkdownContent({ content }: { content: string }) {
  if (!content) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
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
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse" style={{ borderColor: 'var(--border)' }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr style={{ borderBottom: '1px solid var(--border)' }}>{children}</tr>,
        th: ({ children }) => (
          <th className="px-2 py-1 text-left font-semibold" style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>{children}</th>
        ),
        td: ({ children }) => <td className="px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
