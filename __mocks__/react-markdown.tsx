// Jest stub for react-markdown — renders children as plain text to avoid ESM transform issues
import React from 'react'

interface ReactMarkdownProps {
  children: string
  [key: string]: unknown
}

export default function ReactMarkdown({ children }: ReactMarkdownProps) {
  return <span>{children}</span>
}
