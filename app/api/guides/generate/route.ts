import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient, buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'
import type { Guide, GuideSection, ContentElement, GuideMode } from '@/types/guide'

const ALLOWED_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown'])

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
  const mode = (formData.get('mode') ?? 'math-cs') as GuideMode

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

  const contentBlocks = await Promise.all(files.map(fileToContentBlock))

  const client = getClient()
  const message = await client.messages.create({
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

  const rawText = message.content.find(b => b.type === 'text')?.text ?? ''

  let parsed: ClaudeGuide
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return NextResponse.json({ error: 'Claude returned invalid JSON' }, { status: 500 })
  }

  const guide = assignIds(parsed, mode)
  return NextResponse.json(guide)
}
