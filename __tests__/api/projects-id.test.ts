/**
 * @jest-environment node
 */
import { GET, DELETE } from '@/app/api/projects/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}))
jest.mock('@/lib/storage', () => ({
  deleteFile: jest.fn(),
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(method: string, id: string) {
  return new NextRequest(`http://localhost/api/projects/${id}`, { method })
}

beforeEach(() => jest.clearAllMocks())

const mockDate = new Date('2026-04-11T00:00:00Z')
const mockProject = {
  id: 'p1',
  userId: 'user-1',
  name: 'Bio Notes',
  createdAt: mockDate,
  files: [{ id: 'f1', projectId: 'p1', name: 'notes.pdf', size: 1000, mimeType: 'application/pdf', storageKey: 'projects/p1/uuid-notes.pdf', uploadedAt: mockDate }],
  guides: [{ id: 'g1', title: 'Guide 1', mode: 'math-cs', createdAt: mockDate }],
}

describe('GET /api/projects/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('GET', 'p1'), makeContext('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('GET', 'missing'), makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when project belongs to another user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-2' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject)
    const res = await GET(makeRequest('GET', 'p1'), makeContext('p1'))
    expect(res.status).toBe(404)
  })

  it('returns project with files and guides', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject)
    const res = await GET(makeRequest('GET', 'p1'), makeContext('p1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.id).toBe('p1')
    expect(json.files).toHaveLength(1)
    expect(json.guides).toHaveLength(1)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', 'p1'), makeContext('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', 'missing'), makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('deletes files from storage then deletes project', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject)
    ;(deleteFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.project.delete as jest.Mock).mockResolvedValue({})

    const res = await DELETE(makeRequest('DELETE', 'p1'), makeContext('p1'))

    expect(res.status).toBe(200)
    expect(deleteFile).toHaveBeenCalledWith('projects/p1/uuid-notes.pdf')
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })
})
