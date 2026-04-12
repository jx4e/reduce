import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient, buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'
import type { ContentBlock } from '@/lib/anthropic'
import type { Guide, GuideSection, ContentElement, GuideMode } from '@/types/guide'
import logger from '@/lib/logger'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { uploadFile, getPresignedDownloadUrl } from '@/lib/storage'

const ALLOWED_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'])

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
  | { type: 'done'; guideId: string }
  | { type: 'error'; message: string }

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const log = logger.child({ route: 'POST /api/guides/generate' })
  const encoder = new TextEncoder()

  function send(controller: ReadableStreamDefaultController, event: GenerateEvent) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const rawMode = formData.get('mode') ?? 'math-cs'
  const projectId = formData.get('projectId') as string | null
  const storedFileIdsRaw = formData.get('storedFileIds') as string | null
  const storedFileIds = storedFileIdsRaw ? storedFileIdsRaw.split(',').filter(Boolean) : []
  const description = (formData.get('description') as string | null)?.trim() || null
  const customTitle = (formData.get('customTitle') as string | null)?.trim() || null

  if (rawMode !== 'math-cs' && rawMode !== 'humanities') {
    log.warn({ rawMode }, 'invalid mode')
    return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400 })
  }
  const mode: GuideMode = rawMode

  if (files.length === 0 && storedFileIds.length === 0) {
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

  log.info({ mode, files: files.map(f => ({ name: f.name, size: f.size })), storedFileIds, projectId }, 'starting generation')

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: 'stage', stage: 'parsing' })

        // Save new uploaded files to project (if projectId provided)
        if (projectId && files.length > 0) {
          for (const file of files) {
            const key = `projects/${projectId}/${randomUUID()}-${file.name}`
            const buffer = Buffer.from(await file.arrayBuffer())
            await uploadFile(key, buffer, file.type)
            await prisma.projectFile.create({
              data: { projectId, name: file.name, size: file.size, mimeType: file.type, storageKey: key },
            })
          }
        }

        // Build content blocks from uploaded files
        let uploadedBlocks: ContentBlock[]
        try {
          uploadedBlocks = await Promise.all(files.map(fileToContentBlock))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to process uploaded files'
          log.error({ err }, 'failed to build content blocks from uploads')
          send(controller, { type: 'error', message })
          controller.close()
          return
        }

        // Build content blocks from stored files
        let storedBlocks: ContentBlock[] = []
        if (storedFileIds.length > 0) {
          try {
            const projectFiles = await prisma.projectFile.findMany({
              where: {
                id: { in: storedFileIds },
                project: { userId: session.user!.id },
              },
            })
            storedBlocks = await Promise.all(
              projectFiles.map(async pf => {
                const url = await getPresignedDownloadUrl(pf.storageKey)
                const res = await fetch(url)
                const buffer = Buffer.from(await res.arrayBuffer())
                const file = new File([buffer], pf.name, { type: pf.mimeType })
                return fileToContentBlock(file)
              }),
            )
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch stored files'
            log.error({ err }, 'failed to fetch stored files')
            send(controller, { type: 'error', message })
            controller.close()
            return
          }
        }

        const contentBlocks: ContentBlock[] = [...storedBlocks, ...uploadedBlocks]
        log.info({ count: contentBlocks.length }, 'content blocks ready')

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
                  {
                    type: 'text',
                    text: description
                      ? `Generate a study guide from the material above.\n\nAdditional context from the user: ${description}`
                      : 'Generate a study guide from the material above.',
                  },
                ],
              },
            ],
          })

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
          if (customTitle) guide = { ...guide, title: customTitle }
        } catch {
          send(controller, { type: 'error', message: 'Failed to process Claude response' })
          controller.close()
          return
        }

        // Verify project ownership before saving
        if (projectId) {
          const project = await prisma.project.findUnique({ where: { id: projectId } })
          if (!project || project.userId !== session.user!.id) {
            send(controller, { type: 'error', message: 'Forbidden' })
            controller.close()
            return
          }
        }

        try {
          await prisma.guide.create({
            data: {
              id: guide.id,
              userId: session.user!.id,
              title: guide.title,
              mode: guide.mode,
              content: guide.sections,
              ...(projectId ? { projectId } : {}),
            },
          })
        } catch (err) {
          log.error({ err }, 'failed to save guide to database')
          send(controller, { type: 'error', message: 'Failed to save guide' })
          controller.close()
          return
        }

        prisma.tokenUsage.create({
          data: {
            userId: session.user!.id,
            operation: 'generate',
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          },
        }).catch(err => log.warn({ err }, 'failed to record token usage'))

        log.info({ id: guide.id, title: guide.title, sections: guide.sections.length }, 'guide saved')
        send(controller, { type: 'done', guideId: guide.id })
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
