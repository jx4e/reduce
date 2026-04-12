// app/api/calendar/gcal/sync/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal, deleteEventFromGcal } from '@/lib/gcal'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const event = await prisma.studyEvent.findUnique({ where: { id } })
  if (!event || event.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const tokens = await getGcalTokens(session.user.id)
  if (!tokens?.hasCalendarScope) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 403 })
  }

  if (event.gcalEventId) {
    try { await deleteEventFromGcal(tokens.accessToken, event.gcalEventId) } catch { /* ok */ }
  }

  const gcalEventId = await pushEventToGcal(tokens.accessToken, {
    title: event.title,
    date: event.date.toISOString(),
    duration: event.duration,
    notes: event.notes,
  })

  await prisma.studyEvent.update({ where: { id }, data: { gcalEventId } })
  return NextResponse.json({ ok: true, gcalEventId })
}
