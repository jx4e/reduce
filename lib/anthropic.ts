import Anthropic from '@anthropic-ai/sdk'
import type { GuideMode } from '@/types/guide'

// ── Singleton client ──────────────────────────────────────────────────────────

let _client: Anthropic | null = null

export function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// ── Prompt builder ────────────────────────────────────────────────────────────

const SCHEMA = `
{
  "title": "string — concise title for this guide",
  "sections": [
    {
      "heading": "string — section title",
      "elements": [
        { "type": "paragraph", "content": "string" },
        { "type": "heading", "content": "string", "level": 2 },
        { "type": "formula", "content": "LaTeX string — KaTeX-compatible, no $ delimiters" },
        { "type": "code", "content": "string", "language": "python|javascript|..." },
        {
          "type": "timeline",
          "content": "brief label",
          "events": [{ "date": "string", "title": "string", "description": "string" }]
        }
      ]
    }
  ]
}`.trim()

const MODE_GUIDANCE: Record<GuideMode, string> = {
  'math-cs': `
- Use "formula" elements (LaTeX) for all equations and mathematical expressions.
- Use "code" elements for algorithms, implementations, and examples.
- Use "timeline" only if the material explicitly covers historical developments.
- Prefer precision over narrative.`.trim(),
  'humanities': `
- Use "timeline" elements for historical sequences; include 5–10 events minimum.
- Use "paragraph" elements for analysis, context, and argument.
- Use "formula" only if the source material contains explicit equations.
- Prefer narrative clarity and structured argument over bullet lists.`.trim(),
}

export function buildSystemPrompt(mode: GuideMode): string {
  return `You are an expert study guide creator. Analyse the provided learning material and produce a structured study guide.

Return ONLY a valid JSON object — no prose, no markdown code fences, no explanation. Just raw JSON.

The JSON must follow this schema exactly:

${SCHEMA}

Do NOT include "id" fields — they will be assigned automatically.
Produce 4–8 sections with a natural mix of element types suited to the material.

Mode-specific guidance (mode: ${mode}):
${MODE_GUIDANCE[mode]}`
}

// ── File → content block ──────────────────────────────────────────────────────

type DocumentBlock = {
  type: 'document'
  source: { type: 'base64'; media_type: 'application/pdf'; data: string }
}

type TextBlock = {
  type: 'text'
  text: string
}

export type ContentBlock = DocumentBlock | TextBlock

export async function fileToContentBlock(file: File): Promise<ContentBlock> {
  if (file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    }
  }
  const text = await file.text()
  return { type: 'text', text }
}
