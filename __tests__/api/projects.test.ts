/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/projects/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function makeRequest(method: string, body?: object) {
  return new NextRequest('http://localhost/api/projects', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns projects scoped to current user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-11T00:00:00Z')
    ;(prisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'p1', name: 'Bio Notes', createdAt: mockDate, _count: { files: 2, guides: 3 } },
    ])

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(json[0].id).toBe('p1')
    expect(json[0].name).toBe('Bio Notes')
    expect(json[0].fileCount).toBe(2)
    expect(json[0].guideCount).toBe(3)
  })
})

describe('POST /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { name: 'Bio' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
  })

  it('creates project and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-11T00:00:00Z')
    ;(prisma.project.create as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Bio', createdAt: mockDate })

    const res = await POST(makeRequest('POST', { name: 'Bio' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('p1')
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Bio' },
    })
  })
})
