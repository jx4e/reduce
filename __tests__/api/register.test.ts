/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/register/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-pw'),
}))

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/auth/register', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'secret123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when email already taken', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' })
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret123' }))
    expect(res.status).toBe(409)
  })

  it('creates user with hashed password and returns 201', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.user.create as jest.Mock).mockResolvedValue({ id: 'new-user' })

    const res = await POST(makeRequest({ name: 'Jake', email: 'a@b.com', password: 'secret123' }))

    expect(res.status).toBe(201)
    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12)
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { name: 'Jake', email: 'a@b.com', password: 'hashed-pw' },
    })
  })
})
