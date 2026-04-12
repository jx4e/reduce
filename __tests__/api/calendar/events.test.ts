/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    studyEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn(),
    },
  },
}))
jest.mock('@/lib/gcal', () => ({
  pushEventToGcal: jest.fn(),
  deleteEventFromGcal: jest.fn(),
  getGcalTokens: jest.fn(),
}))

import { GET, POST } from '@/app/api/calendar/events/route'
import { PUT, DELETE } from '@/app/api/calendar/events/[id]/route'
import { POST as BATCH } from '@/app/api/calendar/events/batch/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

const mockSession = { user: { id: 'user-1' } }

function makeReq(method: string, body?: unknown, url = 'http://localhost/api/calendar/events') {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/calendar/events', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(401)
  })

  it('returns events for authenticated user', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.findMany as jest.Mock).mockResolvedValue([
      { id: 'ev-1', title: 'Exam 1', date: new Date('2026-04-22'), duration: null,
        type: 'exam', guideId: null, gcalEventId: null, notes: null, createdAt: new Date() },
    ])
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].title).toBe('Exam 1')
  })
})

describe('POST /api/calendar/events', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq('POST', { title: 'Test', date: '2026-04-22', type: 'exam' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    const res = await POST(makeReq('POST', { title: 'Test' }))
    expect(res.status).toBe(400)
  })

  it('creates event and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.create as jest.Mock).mockResolvedValue({
      id: 'ev-1', title: 'Exam 1', date: new Date('2026-04-22'), duration: null,
      type: 'exam', guideId: null, gcalEventId: null, notes: null, createdAt: new Date()
    })
    const res = await POST(makeReq('POST', { title: 'Exam 1', date: '2026-04-22T00:00:00Z', type: 'exam' }))
    expect(res.status).toBe(201)
  })
})

describe('DELETE /api/calendar/events/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ev-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when event not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ev-1' }) })
    expect(res.status).toBe(404)
  })

  it('deletes event and returns 200', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.findUnique as jest.Mock).mockResolvedValue({ id: 'ev-1', userId: 'user-1', gcalEventId: null })
    ;(prisma.studyEvent.delete as jest.Mock).mockResolvedValue({})
    const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ev-1' }) })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/calendar/events/batch', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await BATCH(makeReq('POST', []))
    expect(res.status).toBe(401)
  })

  it('returns 400 for non-array body', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    const res = await BATCH(makeReq('POST', { not: 'array' }))
    expect(res.status).toBe(400)
  })

  it('creates multiple events and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.studyEvent.createMany as jest.Mock).mockResolvedValue({ count: 2 })
    const events = [
      { title: 'Exam 1', date: '2026-04-22T00:00:00Z', type: 'exam' },
      { title: 'HW due', date: '2026-04-16T23:59:00Z', type: 'assignment' },
    ]
    const res = await BATCH(makeReq('POST', events))
    expect(res.status).toBe(201)
  })
})
