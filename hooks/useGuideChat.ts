// hooks/useGuideChat.ts
'use client'

import { useEffect, useRef, useState } from 'react'
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
  const messagesRef = useRef<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function updateMessages(updater: (prev: ChatMessage[]) => ChatMessage[]) {
    setMessages(prev => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }

  // Scroll to bottom when messages change (once per state flush, not per chunk)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    updateMessages(prev => [...prev, userMsg, assistantMsg])

    const history = [...messagesRef.current.slice(0, -2), userMsg]

    try {
      await streamChat(
        guide.id,
        { messages: history.map(m => ({ role: m.role, content: m.content })), context },
        (chunk) => {
          updateMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          )
        },
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      updateMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m)
      )
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return { messages, loading, input, setInput, send, chatEndRef, inputRef }
}
