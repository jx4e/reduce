import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient, buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'
import type { ContentBlock } from '@/lib/anthropic'
import type { Guide, GuideSection, ContentElement, GuideMode } from '@/types/guide'
import logger from '@/lib/logger'

const ALLOWED_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'])

// Raw shape Claude returns (no ids)
interface ClaudeElement {
  type: ContentElement['type']
  content?: string
  level?: 2 | 3
  language?: string
  events?: ContentElement['events']
}

interface ClaudeSection {
  heading: string
  elements: ClaudeElement[]
}

interface ClaudeGuide {
  title: string
  sections: ClaudeSection[]
}

function isClaudeGuide(v: unknown): v is ClaudeGuide {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ClaudeGuide).title === 'string' &&
    Array.isArray((v as ClaudeGuide).sections)
  )
}

function assignIds(raw: ClaudeGuide, mode: GuideMode): Guide {
  const sections: GuideSection[] = raw.sections.map(s => ({
    id: randomUUID(),
    heading: s.heading,
    elements: s.elements.map(el => ({
      id: randomUUID(),
      type: el.type,
      content: el.content ?? '',
      ...(el.level !== undefined && { level: el.level }),
      ...(el.language !== undefined && { language: el.language }),
      ...(el.events !== undefined && { events: el.events }),
    } as ContentElement)),
  }))

  return {
    id: randomUUID(),
    title: raw.title,
    mode,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    sections,
  }
}

// SSE event types the client receives
export type GenerateEvent =
  | { type: 'stage'; stage: 'parsing' | 'analyzing' | 'writing' | 'rendering' }
  | { type: 'done'; guide: Guide }
  | { type: 'error'; message: string }

export async function POST(request: NextRequest): Promise<Response> {
  const log = logger.child({ route: 'POST /api/guides/generate' })
  const encoder = new TextEncoder()

  function send(controller: ReadableStreamDefaultController, event: GenerateEvent) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }

  // Validate inputs before opening the stream so we can still return HTTP errors
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const rawMode = formData.get('mode') ?? 'math-cs'

  if (rawMode !== 'math-cs' && rawMode !== 'humanities') {
    log.warn({ rawMode }, 'invalid mode')
    return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400 })
  }
  const mode: GuideMode = rawMode

  if (files.length === 0) {
    return new Response(JSON.stringify({ error: 'No files provided' }), { status: 400 })
  }

  const badFile = files.find(f => !ALLOWED_TYPES.has(f.type))
  if (badFile) {
    return new Response(
      JSON.stringify({ error: `Unsupported file type: ${badFile.type}. Allowed: PDF, plain text, markdown.` }),
      { status: 400 },
    )
  }

  const MAX_FILES = 5
  const MAX_BYTES = 10 * 1024 * 1024

  if (files.length > MAX_FILES) {
    return new Response(JSON.stringify({ error: `Maximum ${MAX_FILES} files allowed` }), { status: 400 })
  }
  const oversized = files.find(f => f.size > MAX_BYTES)
  if (oversized) {
    return new Response(
      JSON.stringify({ error: `File "${oversized.name}" exceeds 10 MB limit` }),
      { status: 400 },
    )
  }

  log.info({ mode, files: files.map(f => ({ name: f.name, size: f.size })) }, 'starting generation')

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stage 1: Parsing
        send(controller, { type: 'stage', stage: 'parsing' })
        let contentBlocks: ContentBlock[]
        try {
          contentBlocks = await Promise.all(files.map(fileToContentBlock))
          log.info({ count: contentBlocks.length }, 'content blocks ready')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to process uploaded files'
          log.error({ err }, 'failed to build content blocks')
          send(controller, { type: 'error', message })
          controller.close()
          return
        }

        // Stage 2: Analyzing — call Claude with streaming
        send(controller, { type: 'stage', stage: 'analyzing' })
        log.info({ model: 'claude-sonnet-4-6', mode }, 'calling Claude')

        const client = getClient()
        let rawText = ''
        try {
          const claudeStream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            system: buildSystemPrompt(mode),
            messages: [
              {
                role: 'user',
                content: [
                  ...contentBlocks,
                  { type: 'text', text: 'Generate a study guide from the material above.' },
                ],
              },
            ],
          })

          // Advance to Writing once first token arrives
          let writingSignalled = false
          claudeStream.on('text', chunk => {
            rawText += chunk
            if (!writingSignalled) {
              writingSignalled = true
              send(controller, { type: 'stage', stage: 'writing' })
            }
          })

          const finalMessage = await claudeStream.finalMessage()
          log.info({
            stop_reason: finalMessage.stop_reason,
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
          }, 'Claude finished')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'AI service error'
          log.error({ err }, 'Anthropic API error')
          send(controller, { type: 'error', message })
          controller.close()
          return
        }

        // Stage 3: Rendering — parse and assemble guide
        send(controller, { type: 'stage', stage: 'rendering' })

        if (!rawText) {
          send(controller, { type: 'error', message: 'Claude returned an empty response.' })
          controller.close()
          return
        }

        const jsonText = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/, '')
          .trim()

        let parsed: ClaudeGuide
        try {
          parsed = JSON.parse(jsonText)
        } catch {
          log.error({ rawText: rawText.slice(0, 500) }, 'Claude returned invalid JSON')
          send(controller, { type: 'error', message: 'Claude returned invalid JSON' })
          controller.close()
          return
        }

        if (!isClaudeGuide(parsed)) {
          log.error({ keys: Object.keys(parsed as object) }, 'unexpected JSON structure')
          send(controller, { type: 'error', message: 'Claude returned unexpected JSON structure' })
          controller.close()
          return
        }

        let guide: Guide
        try {
          guide = assignIds(parsed, mode)
        } catch {
          send(controller, { type: 'error', message: 'Failed to process Claude response' })
          controller.close()
          return
        }

        log.info({ id: guide.id, title: guide.title, sections: guide.sections.length }, 'guide generated')
        send(controller, { type: 'done', guide })
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error'
        log.error({ err }, 'unhandled error in generation stream')
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
