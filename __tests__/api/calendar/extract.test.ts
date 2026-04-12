/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/calendarAI', () => ({
  extractDatesFromText: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  prisma: { tokenUsage: { create: jest.fn() } },
}))

import { POST } from '@/app/api/calendar/extract/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { extractDatesFromText } from '@/lib/calendarAI'

const mockSession = { user: { id: 'user-1' } }

beforeEach(() => jest.clearAllMocks())

describe('POST /api/calendar/extract', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/calendar/extract', {
      method: 'POST',
      body: JSON.stringify({ text: 'Exam: April 22' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no text provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest('http://localhost/api/calendar/extract', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns extracted events', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(extractDatesFromText as jest.Mock).mockResolvedValue({
      events: [{ title: 'Exam 1', date: '2026-04-22', type: 'exam' }],
      inputTokens: 100,
      outputTokens: 50,
    })
    const req = new NextRequest('http://localhost/api/calendar/extract', {
      method: 'POST',
      body: JSON.stringify({ text: 'Exam 1: April 22' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].type).toBe('exam')
  })
})
