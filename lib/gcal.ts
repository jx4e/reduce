// lib/gcal.ts
import { prisma } from '@/lib/db'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GCAL_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GcalTokens {
  accessToken: string
  hasCalendarScope: boolean
}

export async function getGcalTokens(userId: string): Promise<GcalTokens | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
    select: { access_token: true, refresh_token: true, scope: true, expires_at: true, providerAccountId: true },
  })
  if (!account?.access_token) return null

  let accessToken = account.access_token

  // Refresh if expired (expires_at is Unix seconds)
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 60) {
    if (!account.refresh_token) return null
    try {
      const refreshed = await refreshAccessToken(account.refresh_token)
      accessToken = refreshed.access_token
      await prisma.account.update({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: account.providerAccountId } },
        data: {
          access_token: refreshed.access_token,
          expires_at: refreshed.expires_at,
        },
      })
    } catch {
      return null
    }
  }

  return {
    accessToken,
    hasCalendarScope: (account.scope ?? '').includes(GCAL_SCOPE),
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Failed to refresh Google access token')
  const data = await res.json() as { access_token: string; expires_in: number }
  return {
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  }
}

export async function pushEventToGcal(
  accessToken: string,
  event: { title: string; date: string; duration: number | null; notes: string | null }
): Promise<string> {
  const isAllDay = !event.duration
  const startDate = new Date(event.date)
  const endDate = event.duration
    ? new Date(startDate.getTime() + event.duration * 60_000)
    : new Date(startDate.getTime() + 24 * 60 * 60_000)

  const body = {
    summary: event.title,
    description: event.notes ?? '',
    start: isAllDay
      ? { date: startDate.toISOString().split('T')[0] }
      : { dateTime: startDate.toISOString(), timeZone: 'UTC' },
    end: isAllDay
      ? { date: endDate.toISOString().split('T')[0] }
      : { dateTime: endDate.toISOString(), timeZone: 'UTC' },
  }

  const res = await fetch(GCAL_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`GCal API error: ${res.status}`)
  const data = await res.json() as { id: string }
  return data.id
}

export async function deleteEventFromGcal(accessToken: string, gcalEventId: string): Promise<void> {
  const res = await fetch(`${GCAL_API}/${gcalEventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 410) {
    // 410 = already deleted; treat as success
    throw new Error(`GCal delete error: ${res.status}`)
  }
}
