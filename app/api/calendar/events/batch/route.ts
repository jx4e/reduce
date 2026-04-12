import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal } from '@/lib/gcal'
import type { CreateEventPayload } from '@/types/calendar'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: CreateEventPayload[] = await request.json().catch(() => null)
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an array of events' }, { status: 400 })
  }

  const data = body.map(e => ({
    userId: session.user.id,
    title: e.title,
    date: new Date(e.date),
    duration: e.duration ?? null,
    type: e.type,
    guideId: e.guideId ?? null,
    notes: e.notes ?? null,
  }))

  await prisma.studyEvent.createMany({ data })

  // Fetch the created events to push to GCal
  const tokens = await getGcalTokens(session.user.id)
  if (tokens?.hasCalendarScope) {
    // Best-effort: fire and forget for batch
    const created = await prisma.studyEvent.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: data.length,
    })
    for (const ev of created) {
      try {
        const gcalEventId = await pushEventToGcal(tokens.accessToken, {
          title: ev.title,
          date: ev.date.toISOString(),
          duration: ev.duration,
          notes: ev.notes,
        })
        await prisma.studyEvent.update({ where: { id: ev.id }, data: { gcalEventId } })
      } catch {
        // non-fatal
      }
    }
  }

  return NextResponse.json({ ok: true, count: data.length }, { status: 201 })
}
