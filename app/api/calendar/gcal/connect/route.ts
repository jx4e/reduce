// app/api/calendar/gcal/connect/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/gcal/callback`,
    response_type: 'code',
    scope: GCAL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: session.user.id,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
