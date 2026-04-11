'use client'

import { useState } from 'react'
import { streamChat, nextId } from '@/lib/chat'
import type { ChatMessage, ContentElement } from '@/types/guide'

export interface UseElementChatReturn {
  messages: ChatMessage[]
  loading: boolean
  send: (question: string) => Promise<void>
}

export function useElementChat(guideId: string, element: ContentElement): UseElementChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  async function send(question: string) {
    if (loading) return
    setLoading(true)

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: question }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, assistantMsg])

    const history = [...messages, userMsg]

    try {
      await streamChat(
        guideId,
        {
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context: { element: { type: element.type, content: element.content } },
        },
        (chunk) => {
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          )
        },
      )
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Something went wrong'
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m)
      )
    } finally {
      setLoading(false)
    }
  }

  return { messages, loading, send }
}
