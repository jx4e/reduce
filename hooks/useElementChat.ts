// hooks/useElementChat.ts
'use client'

import { useRef, useState } from 'react'
import { streamChat, nextId } from '@/lib/chat'
import type { ChatMessage, ContentElement } from '@/types/guide'

export interface UseElementChatReturn {
  messages: ChatMessage[]
  loading: boolean
  send: (question: string) => Promise<void>
}

export function useElementChat(guideId: string, element: ContentElement): UseElementChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesRef = useRef<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  function updateMessages(updater: (prev: ChatMessage[]) => ChatMessage[]) {
    setMessages(prev => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }

  async function send(question: string) {
    if (loading) return
    setLoading(true)

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: question }
    const assistantId = nextId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }

    updateMessages(prev => [...prev, userMsg, assistantMsg])

    const history = [...messagesRef.current.slice(0, -2), userMsg]

    try {
      await streamChat(
        guideId,
        {
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context: { guideTitle: '', sectionHeadings: [], element: { type: element.type, content: element.content } },
        },
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
    }
  }

  return { messages, loading, send }
}
