/**
 * @jest-environment node
 */
import { DELETE } from '@/app/api/projects/[id]/files/[fileId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    projectFile: {
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

function makeContext(id: string, fileId: string) {
  return { params: Promise.resolve({ id, fileId }) }
}

function makeRequest(id: string, fileId: string) {
  return new NextRequest(`http://localhost/api/projects/${id}/files/${fileId}`, { method: 'DELETE' })
}

const mockFile = {
  id: 'pf1',
  projectId: 'p1',
  name: 'notes.pdf',
  storageKey: 'projects/p1/uuid-notes.pdf',
  project: { userId: 'user-1' },
}

beforeEach(() => jest.clearAllMocks())

describe('DELETE /api/projects/[id]/files/[fileId]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('p1', 'pf1'), makeContext('p1', 'pf1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when file not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('p1', 'missing'), makeContext('p1', 'missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when file belongs to another user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-2' } })
    ;(prisma.projectFile.findUnique as jest.Mock).mockResolvedValue(mockFile)
    const res = await DELETE(makeRequest('p1', 'pf1'), makeContext('p1', 'pf1'))
    expect(res.status).toBe(404)
  })

  it('deletes from storage and DB', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findUnique as jest.Mock).mockResolvedValue(mockFile)
    ;(deleteFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.projectFile.delete as jest.Mock).mockResolvedValue({})

    const res = await DELETE(makeRequest('p1', 'pf1'), makeContext('p1', 'pf1'))

    expect(res.status).toBe(200)
    expect(deleteFile).toHaveBeenCalledWith('projects/p1/uuid-notes.pdf')
    expect(prisma.projectFile.delete).toHaveBeenCalledWith({ where: { id: 'pf1' } })
  })
})
