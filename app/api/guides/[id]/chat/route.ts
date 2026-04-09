import type { NextRequest } from 'next/server'
import { getClient } from '@/lib/anthropic'
import logger from '@/lib/logger'

export interface ChatRequestBody {
  messages: { role: 'user' | 'assistant'; content: string }[]
  context: {
    guideTitle: string
    sectionHeadings: string[]
    element?: { type: string; content: string }
  }
}

export type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/guides/[id]/chat'>
): Promise<Response> {
  const { id } = await ctx.params
  const log = logger.child({ route: 'POST /api/guides/[id]/chat', guideId: id })

  let body: ChatRequestBody
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { messages, context } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 })
  }

  const systemPrompt = context.element
    ? `You are a tutor answering a question about a specific part of a study guide.

Guide: "${context.guideTitle}"

The student is asking about this ${context.element.type}:
"""
${context.element.content}
"""

Rules:
- Answer in 2–4 sentences maximum. If a longer answer is truly needed, use at most 3 short bullet points.
- Stay focused on the element above.
- Plain text only — no markdown headers or bold.`
    : `You are a tutor answering questions about a study guide.

Guide: "${context.guideTitle}"
Sections: ${context.sectionHeadings.join(' · ')}

Rules:
- Answer in 2–4 sentences maximum. If a longer answer is truly needed, use at most 3 short bullet points.
- Plain text only — no markdown headers or bold.`

  log.info({
    messageCount: messages.length,
    hasElement: !!context.element,
    elementType: context.element?.type,
  }, 'chat request')

  const encoder = new TextEncoder()

  function send(controller: ReadableStreamDefaultController, event: ChatEvent) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = getClient()
        const claudeStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        })

        claudeStream.on('text', (chunk: string) => {
          send(controller, { type: 'delta', text: chunk })
        })

        const final = await claudeStream.finalMessage()
        log.info({
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          stop_reason: final.stop_reason,
        }, 'chat response done')

        send(controller, { type: 'done' })
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI service error'
        log.error({ err }, 'chat stream error')
        send(controller, { type: 'error', message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
