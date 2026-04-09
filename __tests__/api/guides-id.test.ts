/**
 * @jest-environment node
 */
import { GET } from '@/app/api/guides/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    guide: {
      findUnique: jest.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/guides/${id}`)
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/guides/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('g1'), makeContext('g1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when guide does not exist', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.guide.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('missing'), makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when guide belongs to a different user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.guide.findUnique as jest.Mock).mockResolvedValue({
      id: 'g1', userId: 'user-2', title: 'Test', mode: 'math-cs', content: [], createdAt: new Date(),
    })
    const res = await GET(makeRequest('g1'), makeContext('g1'))
    expect(res.status).toBe(404)
  })

  it('returns the guide when it belongs to the current user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-08T00:00:00Z')
    ;(prisma.guide.findUnique as jest.Mock).mockResolvedValue({
      id: 'g1', userId: 'user-1', title: 'Calculus', mode: 'math-cs', content: [{ id: 's1' }], createdAt: mockDate,
    })

    const res = await GET(makeRequest('g1'), makeContext('g1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('g1')
    expect(json.title).toBe('Calculus')
    expect(json.sections).toEqual([{ id: 's1' }])
    expect(typeof json.createdAt).toBe('string')
  })
})
