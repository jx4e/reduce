/**
 * @jest-environment node
 */

jest.mock('@/lib/db', () => ({
  prisma: {
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

import { getGcalTokens, pushEventToGcal, deleteEventFromGcal } from '@/lib/gcal'
import { prisma } from '@/lib/db'

beforeEach(() => jest.clearAllMocks())

describe('getGcalTokens', () => {
  it('returns null when no Google account found', async () => {
    ;(prisma.account.findFirst as jest.Mock).mockResolvedValue(null)
    const result = await getGcalTokens('user-1')
    expect(result).toBeNull()
  })

  it('returns tokens with hasCalendarScope=false when scope missing', async () => {
    ;(prisma.account.findFirst as jest.Mock).mockResolvedValue({
      access_token: 'tok',
      refresh_token: 'ref',
      scope: 'openid email profile',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      providerAccountId: 'google-id-1',
    })
    const result = await getGcalTokens('user-1')
    expect(result?.hasCalendarScope).toBe(false)
  })

  it('returns tokens with hasCalendarScope=true when scope present', async () => {
    ;(prisma.account.findFirst as jest.Mock).mockResolvedValue({
      access_token: 'tok',
      refresh_token: 'ref',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      providerAccountId: 'google-id-1',
    })
    const result = await getGcalTokens('user-1')
    expect(result?.hasCalendarScope).toBe(true)
    expect(result?.accessToken).toBe('tok')
  })
})

describe('pushEventToGcal', () => {
  it('returns gcal event id on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'gcal-event-123' }),
    })
    const id = await pushEventToGcal('access-token', {
      title: 'Exam 1',
      date: '2026-04-22T09:00:00Z',
      duration: null,
      notes: null,
    })
    expect(id).toBe('gcal-event-123')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    await expect(
      pushEventToGcal('bad-token', { title: 'X', date: '2026-04-22T00:00:00Z', duration: null, notes: null })
    ).rejects.toThrow()
  })
})

describe('deleteEventFromGcal', () => {
  it('calls DELETE on GCal API', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await deleteEventFromGcal('access-token', 'gcal-event-123')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gcal-event-123'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})
