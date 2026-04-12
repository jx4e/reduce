import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal } from '@/lib/gcal'
import type { StudyEventData, CreateEventPayload } from '@/types/calendar'

function rowToData(r: {
  id: string; title: string; date: Date; duration: number | null
  type: string; guideId: string | null; gcalEventId: string | null
  notes: string | null; createdAt: Date
}): StudyEventData {
  return {
    id: r.id,
    title: r.title,
    date: r.date.toISOString(),
    duration: r.duration,
    type: r.type as StudyEventData['type'],
    guideId: r.guideId,
    gcalEventId: r.gcalEventId,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const rows = await prisma.studyEvent.findMany({
    where: {
      userId: session.user.id,
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(rows.map(rowToData))
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: CreateEventPayload = await request.json().catch(() => null)
  if (!body?.title || !body?.date || !body?.type) {
    return NextResponse.json({ error: 'title, date, and type are required' }, { status: 400 })
  }

  let event
  try {
    event = await prisma.studyEvent.create({
      data: {
        userId: session.user.id,
        title: body.title,
        date: new Date(body.date),
        duration: body.duration ?? null,
        type: body.type,
        guideId: body.guideId ?? null,
        notes: body.notes ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[calendar/events POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Push to GCal if connected
  const tokens = await getGcalTokens(session.user.id)
  if (tokens?.hasCalendarScope) {
    try {
      const gcalEventId = await pushEventToGcal(tokens.accessToken, {
        title: event.title,
        date: event.date.toISOString(),
        duration: event.duration,
        notes: event.notes,
      })
      await prisma.studyEvent.update({
        where: { id: event.id },
        data: { gcalEventId },
      })
    } catch {
      // GCal push failure is non-fatal
    }
  }

  return NextResponse.json(rowToData(event), { status: 201 })
}
