// lib/calendarAI.ts
import { getClient, type ContentBlock } from '@/lib/anthropic'
import type { CandidateEvent } from '@/types/calendar'

export async function extractDatesFromText(input: string | ContentBlock): Promise<{
  events: CandidateEvent[]
  inputTokens: number
  outputTokens: number
}> {
  const client = getClient()
  // Anthropic SDK accepts string or array of content blocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageContent: any = typeof input === 'string' ? input : [input]
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a date extraction assistant. Extract all academic dates, deadlines, and events from the provided text.
Return ONLY a valid JSON array. Each item must have:
- "title": string (brief descriptive name)
- "date": string (ISO 8601 format, e.g. "2026-04-22" or "2026-04-22T09:00:00Z" if time is specified)
- "type": one of "exam", "assignment", or "other"

If the year is ambiguous, assume the current or next upcoming year. Return [] if no dates found.`,
    messages: [{ role: 'user', content: messageContent }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return { events: [], inputTokens: 0, outputTokens: 0 }

  let events: CandidateEvent[] = []
  try {
    const parsed = JSON.parse(content.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    events = Array.isArray(parsed) ? parsed : []
  } catch {
    events = []
  }

  return {
    events,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

export async function generateStudyPlan(
  events: CandidateEvent[],
  today: string
): Promise<{
  sessions: CandidateEvent[]
  inputTokens: number
  outputTokens: number
}> {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a study planner. Given a list of upcoming exams and deadlines, generate a set of study sessions leading up to each one.
Rules:
- Schedule 3–5 study sessions before each exam, spread evenly
- Schedule 1–2 review sessions before each assignment deadline
- Each session is 45–60 minutes
- Do not schedule sessions in the past (today is ${today})
- Space sessions at least 1 day apart for the same subject

Return ONLY a valid JSON array. Each item must have:
- "title": string (e.g. "Study for Exam 1")
- "date": ISO 8601 datetime string (e.g. "2026-04-20T15:00:00Z")
- "type": "study"
- "duration": number (minutes, 45 or 60)`,
    messages: [{
      role: 'user',
      content: `Today: ${today}\n\nUpcoming events:\n${JSON.stringify(events, null, 2)}`,
    }],
  })

  const content = response.content[0]
  if (content.type !== 'text') return { sessions: [], inputTokens: 0, outputTokens: 0 }

  let sessions: CandidateEvent[] = []
  try {
    const parsed = JSON.parse(content.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    sessions = Array.isArray(parsed) ? parsed : []
  } catch {
    sessions = []
  }

  return {
    sessions,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
