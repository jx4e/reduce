/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/calendarAI', () => ({
  generateStudyPlan: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  prisma: { tokenUsage: { create: jest.fn() } },
}))

import { POST } from '@/app/api/calendar/generate-plan/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { generateStudyPlan } from '@/lib/calendarAI'

const mockSession = { user: { id: 'user-1' } }

beforeEach(() => jest.clearAllMocks())

describe('POST /api/calendar/generate-plan', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/calendar/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ events: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns generated study sessions', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(generateStudyPlan as jest.Mock).mockResolvedValue({
      sessions: [{ title: 'Study for Exam 1', date: '2026-04-20T15:00:00Z', type: 'study', duration: 60 }],
      inputTokens: 200,
      outputTokens: 100,
    })
    const req = new NextRequest('http://localhost/api/calendar/generate-plan', {
      method: 'POST',
      body: JSON.stringify({ events: [{ title: 'Exam 1', date: '2026-04-22', type: 'exam' }] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].type).toBe('study')
  })
})
