/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    projectFile: { findMany: jest.fn(), create: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  uploadFile: jest.fn(),
  getPresignedDownloadUrl: jest.fn(),
}))
jest.mock('@/lib/anthropic', () => ({
  getClient: jest.fn(),
  buildSystemPrompt: jest.fn(() => 'system'),
  fileToContentBlock: jest.fn(async (f: File) => ({ type: 'text', text: `content:${f.name}` })),
}))
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid'),
}))

import { POST } from '@/app/api/guides/generate/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { uploadFile, getPresignedDownloadUrl } from '@/lib/storage'

function makeFormData(
  files: { name: string; type: string; content: string }[],
  extra: Record<string, string> = {},
) {
  const fd = new FormData()
  files.forEach(f => fd.append('files', new File([f.content], f.name, { type: f.type })))
  Object.entries(extra).forEach(([k, v]) => fd.append(k, v))
  return new NextRequest('http://localhost/api/guides/generate', { method: 'POST', body: fd })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/guides/generate — stored files', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeFormData([{ name: 'a.txt', type: 'text/plain', content: 'hi' }]))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no files and no storedFileIds', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const res = await POST(makeFormData([], { mode: 'math-cs' }))
    expect(res.status).toBe(400)
  })

  it('fetches stored files from storage when storedFileIds provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findMany as jest.Mock).mockResolvedValue([
      { id: 'f1', projectId: 'p1', name: 'stored.txt', mimeType: 'text/plain', storageKey: 'projects/p1/stored.txt', size: 5 },
    ])
    ;(getPresignedDownloadUrl as jest.Mock).mockResolvedValue('https://storage.example.com/stored.txt')

    global.fetch = jest.fn().mockResolvedValueOnce({
      arrayBuffer: async () => new ArrayBuffer(5),
    }) as jest.Mock

    const mockStream = {
      on: jest.fn((event: string, cb: (chunk: string) => void) => {
        if (event === 'text') cb('{"title":"T","sections":[]}')
        return mockStream
      }),
      finalMessage: jest.fn().mockResolvedValue({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }),
    }
    const { getClient } = await import('@/lib/anthropic')
    ;(getClient as jest.Mock).mockReturnValue({ messages: { stream: jest.fn(() => mockStream) } })

    const res = await POST(makeFormData([], { mode: 'math-cs', storedFileIds: 'f1', projectId: 'p1' }))
    // Consume the stream to ensure all async work completes before asserting
    await res.text()

    expect(getPresignedDownloadUrl).toHaveBeenCalledWith('projects/p1/stored.txt')
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('uploads new files to project when projectId provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findMany as jest.Mock).mockResolvedValue([])
    ;(uploadFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.projectFile.create as jest.Mock).mockResolvedValue({})

    const mockStream = {
      on: jest.fn((event: string, cb: (chunk: string) => void) => {
        if (event === 'text') cb('{"title":"T","sections":[]}')
        return mockStream
      }),
      finalMessage: jest.fn().mockResolvedValue({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }),
    }
    const { getClient } = await import('@/lib/anthropic')
    ;(getClient as jest.Mock).mockReturnValue({ messages: { stream: jest.fn(() => mockStream) } })

    const res = await POST(makeFormData([{ name: 'new.txt', type: 'text/plain', content: 'hello' }], { mode: 'math-cs', projectId: 'p1' }))
    // Consume the stream to ensure all async work completes before asserting
    await res.text()

    expect(uploadFile).toHaveBeenCalledWith('projects/p1/test-uuid-new.txt', expect.any(Buffer), 'text/plain')
    expect(prisma.projectFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1', name: 'new.txt' }),
    })
  })
})
