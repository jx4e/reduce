// lib/chat.ts
import type { ChatRequestBody, ChatEvent } from '@/app/api/guides/[id]/chat/route'

let msgIdCounter = 0
export function nextId(): string {
  return `msg-${++msgIdCounter}`
}

export async function streamChat(
  guideId: string,
  body: ChatRequestBody,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/guides/${guideId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Chat failed' }))
    throw new Error(err.error ?? 'Chat failed')
  }

  if (!res.body) throw new Error('Response body is null')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const event: ChatEvent = JSON.parse(line.slice(6))
      if (event.type === 'delta') onDelta(event.text)
      else if (event.type === 'error') throw new Error(event.message)
    }
  }
}
