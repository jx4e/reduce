// app/api/calendar/gcal/status/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getGcalTokens } from '@/lib/gcal'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokens = await getGcalTokens(session.user.id)
  return NextResponse.json({
    isGoogleUser: tokens !== null,
    hasCalendarScope: tokens?.hasCalendarScope ?? false,
  })
}
