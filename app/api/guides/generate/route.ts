import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient, buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'
import type { ContentBlock } from '@/lib/anthropic'
import type { Guide, GuideSection, ContentElement, GuideMode } from '@/types/guide'

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
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const rawMode = formData.get('mode') ?? 'math-cs'
  if (rawMode !== 'math-cs' && rawMode !== 'humanities') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  const mode: GuideMode = rawMode

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const badFile = files.find(f => !ALLOWED_TYPES.has(f.type))
  if (badFile) {
    return NextResponse.json(
      { error: `Unsupported file type: ${badFile.type}. Allowed: PDF, plain text, markdown.` },
      { status: 400 },
    )
  }

  const MAX_FILES = 5
  const MAX_BYTES = 10 * 1024 * 1024 // 10 MB per file

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 })
  }
  const oversized = files.find(f => f.size > MAX_BYTES)
  if (oversized) {
    return NextResponse.json({ error: `File "${oversized.name}" exceeds 10 MB limit` }, { status: 400 })
  }

  let contentBlocks: ContentBlock[]
  try {
    contentBlocks = await Promise.all(files.map(fileToContentBlock))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process uploaded files'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI service error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const rawText = message.content.find(b => b.type === 'text')?.text ?? ''
  if (!rawText) {
    const reason = message.stop_reason === 'max_tokens' ? 'Response was truncated — try fewer or smaller files.' : 'Claude returned an empty response.'
    return NextResponse.json({ error: reason }, { status: 500 })
  }

  let parsed: ClaudeGuide
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 })
  }

  if (!isClaudeGuide(parsed)) {
    return NextResponse.json({ error: 'Claude returned unexpected JSON structure' }, { status: 500 })
  }

  let guide: Guide
  try {
    guide = assignIds(parsed, mode)
  } catch {
    return NextResponse.json({ error: 'Failed to process Claude response' }, { status: 500 })
  }
  return NextResponse.json(guide)
}
