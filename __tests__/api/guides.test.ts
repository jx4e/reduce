/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/guides/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    guide: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function makeRequest(method: string, body?: object) {
  return new NextRequest('http://localhost/api/guides', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/guides', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns guides scoped to current user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-08T00:00:00Z')
    ;(prisma.guide.findMany as jest.Mock).mockResolvedValue([
      { id: 'g1', title: 'Calculus', mode: 'math-cs', createdAt: mockDate },
    ])

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.guide.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(json[0].id).toBe('g1')
    expect(json[0].title).toBe('Calculus')
    expect(typeof json[0].createdAt).toBe('string')
  })
})

describe('POST /api/guides', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { id: 'g1', title: 'Test', mode: 'math-cs', sections: [] }))
    expect(res.status).toBe(401)
  })

  it('saves guide with projectId when provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.guide.create as jest.Mock).mockResolvedValue({})

    const body = { id: 'g1', title: 'Calculus', mode: 'math-cs', sections: [], projectId: 'p1' }
    const res = await POST(makeRequest('POST', body))

    expect(res.status).toBe(201)
    expect(prisma.guide.create).toHaveBeenCalledWith({
      data: { id: 'g1', userId: 'user-1', title: 'Calculus', mode: 'math-cs', content: [], projectId: 'p1' },
    })
  })

  it('saves guide with userId and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.guide.create as jest.Mock).mockResolvedValue({})

    const body = { id: 'g1', title: 'Calculus', mode: 'math-cs', sections: [], createdAt: 'Apr 8, 2026' }
    const res = await POST(makeRequest('POST', body))

    expect(res.status).toBe(201)
    expect(prisma.guide.create).toHaveBeenCalledWith({
      data: { id: 'g1', userId: 'user-1', title: 'Calculus', mode: 'math-cs', content: [] },
    })
  })
})
