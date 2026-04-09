import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const log = logger.child({ route: 'POST /api/guides/generate' })

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const rawMode = formData.get('mode') ?? 'math-cs'
  if (rawMode !== 'math-cs' && rawMode !== 'humanities') {
    log.warn({ rawMode }, 'invalid mode')
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  const mode: GuideMode = rawMode

  if (files.length === 0) {
    log.warn('no files provided')
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const badFile = files.find(f => !ALLOWED_TYPES.has(f.type))
  if (badFile) {
    log.warn({ type: badFile.type, name: badFile.name }, 'unsupported file type')
    return NextResponse.json(
      { error: `Unsupported file type: ${badFile.type}. Allowed: PDF, plain text, markdown.` },
      { status: 400 },
    )
  }

  const MAX_FILES = 5
  const MAX_BYTES = 10 * 1024 * 1024 // 10 MB per file

  if (files.length > MAX_FILES) {
    log.warn({ count: files.length }, 'too many files')
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 })
  }
  const oversized = files.find(f => f.size > MAX_BYTES)
  if (oversized) {
    log.warn({ name: oversized.name, size: oversized.size }, 'file too large')
    return NextResponse.json({ error: `File "${oversized.name}" exceeds 10 MB limit` }, { status: 400 })
  }

  log.info({
    mode,
    files: files.map(f => ({ name: f.name, type: f.type, size: f.size })),
  }, 'processing request')

  let contentBlocks: ContentBlock[]
  try {
    contentBlocks = await Promise.all(files.map(fileToContentBlock))
    log.info({ count: contentBlocks.length }, 'content blocks ready')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process uploaded files'
    log.error({ err }, 'failed to build content blocks')
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  log.info({ model: 'claude-sonnet-4-6', mode }, 'calling Claude')
  const client = getClient()
  let message: Awaited<ReturnType<typeof client.messages.create>>
  try {
    message = await client.messages.create({
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
    log.info({
      stop_reason: message.stop_reason,
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    }, 'Claude responded')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI service error'
    log.error({ err }, 'Anthropic API error')
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const rawText = message.content.find(b => b.type === 'text')?.text ?? ''
  if (!rawText) {
    const reason = message.stop_reason === 'max_tokens' ? 'Response was truncated — try fewer or smaller files.' : 'Claude returned an empty response.'
    log.error({ stop_reason: message.stop_reason }, 'empty response from Claude')
    return NextResponse.json({ error: reason }, { status: 500 })
  }

  // Strip markdown code fences if Claude wrapped the JSON despite instructions
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  log.debug({ jsonText: jsonText.slice(0, 300) }, 'attempting JSON parse')

  let parsed: ClaudeGuide
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    log.error({ rawText: rawText.slice(0, 500) }, 'Claude returned invalid JSON')
    return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 })
  }

  if (!isClaudeGuide(parsed)) {
    log.error({ keys: Object.keys(parsed as object) }, 'Claude returned unexpected JSON structure')
    return NextResponse.json({ error: 'Claude returned unexpected JSON structure' }, { status: 500 })
  }

  let guide: Guide
  try {
    guide = assignIds(parsed, mode)
  } catch {
    log.error('failed to assign IDs to guide')
    return NextResponse.json({ error: 'Failed to process Claude response' }, { status: 500 })
  }

  log.info({ id: guide.id, title: guide.title, sections: guide.sections.length }, 'guide generated')
  return NextResponse.json(guide)
}
