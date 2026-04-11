'use client'

import { useRef, useState } from 'react'
import { streamChat, nextId } from '@/lib/chat'
import type { ChatMessage, Guide } from '@/types/guide'

export interface UseGuideChatReturn {
  messages: ChatMessage[]
  loading: boolean
  input: string
  setInput: (value: string) => void
  send: () => Promise<void>
  chatEndRef: React.RefObject<HTMLDivElement>
  inputRef: React.RefObject<HTMLInputElement>
}

export function useGuideChat(guide: Guide): UseGuideChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)

    const context = {
      guideTitle: guide.title,
      sectionHeadings: guide.sections.map(s => s.heading),
    }

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: q }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    const history = [...messages, userMsg]

    try {
      await streamChat(
        guide.id,
        { messages: history.map(m => ({ role: m.role, content: m.content })), context },
        (chunk) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          )
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        },
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m)
      )
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return { messages, loading, input, setInput, send, chatEndRef, inputRef }
}
