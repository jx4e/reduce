// app/api/calendar/generate-plan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { generateStudyPlan } from '@/lib/calendarAI'
import type { CandidateEvent } from '@/types/calendar'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { events: CandidateEvent[] } = await request.json().catch(() => null)
  if (!Array.isArray(body?.events)) {
    return NextResponse.json({ error: 'events array is required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]
  const { sessions, inputTokens, outputTokens } = await generateStudyPlan(body.events, today)

  await prisma.tokenUsage.create({
    data: {
      userId: session.user.id,
      operation: 'calendar-generate-plan',
      inputTokens,
      outputTokens,
    },
  })

  return NextResponse.json(sessions)
}
