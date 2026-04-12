/**
 * @jest-environment node
 */
import { POST } from '@/app/api/projects/[id]/files/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    projectFile: { create: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  uploadFile: jest.fn(),
}))
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid'),
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/storage'

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeFormDataRequest(id: string, files: { name: string; type: string; content: string }[]) {
  const formData = new FormData()
  files.forEach(f => {
    formData.append('files', new File([f.content], f.name, { type: f.type }))
  })
  return new NextRequest(`http://localhost/api/projects/${id}/files`, {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/projects/[id]/files', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeFormDataRequest('p1', []), makeContext('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeFormDataRequest('p1', [{ name: 'a.txt', type: 'text/plain', content: 'hi' }]), makeContext('p1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when no files are provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1' })
    const res = await POST(makeFormDataRequest('p1', []), makeContext('p1'))
    expect(res.status).toBe(400)
  })

  it('uploads file to storage and creates DB record', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1' })
    ;(uploadFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.projectFile.create as jest.Mock).mockResolvedValue({
      id: 'pf1', projectId: 'p1', name: 'notes.txt', size: 2, mimeType: 'text/plain',
      storageKey: 'projects/p1/test-uuid-notes.txt', uploadedAt: new Date(),
    })

    const res = await POST(
      makeFormDataRequest('p1', [{ name: 'notes.txt', type: 'text/plain', content: 'hi' }]),
      makeContext('p1'),
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(uploadFile).toHaveBeenCalledWith(
      'projects/p1/test-uuid-notes.txt',
      expect.any(Buffer),
      'text/plain',
    )
    expect(prisma.projectFile.create).toHaveBeenCalledWith({
      data: {
        projectId: 'p1',
        name: 'notes.txt',
        size: 2,
        mimeType: 'text/plain',
        storageKey: 'projects/p1/test-uuid-notes.txt',
      },
    })
    expect(json).toHaveLength(1)
  })
})
