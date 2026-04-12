import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getGcalTokens, pushEventToGcal, deleteEventFromGcal } from '@/lib/gcal'
import type { CreateEventPayload, StudyEventData } from '@/types/calendar'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.studyEvent.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body: Partial<CreateEventPayload> = await request.json().catch(() => ({}))
  const updated = await prisma.studyEvent.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
      ...(body.duration !== undefined ? { duration: body.duration } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.guideId !== undefined ? { guideId: body.guideId } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  })

  // Update GCal event if connected
  let finalGcalId = updated.gcalEventId
  const tokens = await getGcalTokens(session.user.id)
  if (tokens?.hasCalendarScope && updated.gcalEventId) {
    try {
      await deleteEventFromGcal(tokens.accessToken, updated.gcalEventId)
      const newGcalId = await pushEventToGcal(tokens.accessToken, {
        title: updated.title,
        date: updated.date.toISOString(),
        duration: updated.duration,
        notes: updated.notes,
      })
      await prisma.studyEvent.update({ where: { id }, data: { gcalEventId: newGcalId } })
      finalGcalId = newGcalId
    } catch {
      // non-fatal
    }
  }

  const data: StudyEventData = {
    id: updated.id,
    title: updated.title,
    date: updated.date.toISOString(),
    duration: updated.duration,
    type: updated.type as StudyEventData['type'],
    guideId: updated.guideId,
    gcalEventId: finalGcalId,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.studyEvent.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Delete from GCal first
  if (existing.gcalEventId) {
    const tokens = await getGcalTokens(session.user.id)
    if (tokens?.hasCalendarScope) {
      try {
        await deleteEventFromGcal(tokens.accessToken, existing.gcalEventId)
      } catch {
        // non-fatal
      }
    }
  }

  await prisma.studyEvent.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
