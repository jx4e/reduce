// app/api/calendar/gcal/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const cookieState = request.cookies.get('gcal_state')?.value

  // Verify state matches cookie to prevent CSRF
  if (!code || !userId || cookieState !== userId) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/calendar?gcal=error`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/calendar/gcal/callback`,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) throw new Error('Token exchange failed')

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
    }

    const account = await prisma.account.findFirst({
      where: { userId, provider: 'google' },
      select: { providerAccountId: true, scope: true },
    })

    if (!account) throw new Error('No Google account found')

    // Merge scopes
    const existingScopes = (account.scope ?? '').split(' ').filter(Boolean)
    const newScopes = tokens.scope.split(' ').filter(Boolean)
    const mergedScope = [...new Set([...existingScopes, ...newScopes, GCAL_SCOPE])].join(' ')

    await prisma.account.update({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: account.providerAccountId } },
      data: {
        access_token: tokens.access_token,
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        scope: mergedScope,
      },
    })

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/calendar?gcal=connected`)
  } catch {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/calendar?gcal=error`)
  }
}
