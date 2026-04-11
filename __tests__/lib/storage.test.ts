/**
 * @jest-environment node
 */

const mockSend = jest.fn()
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn(input => ({ _type: 'put', ...input })),
  DeleteObjectCommand: jest.fn(input => ({ _type: 'delete', ...input })),
  GetObjectCommand: jest.fn(input => ({ _type: 'get', ...input })),
}))

const mockGetSignedUrl = jest.fn()
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}))

import { uploadFile, deleteFile, getPresignedDownloadUrl } from '@/lib/storage'

beforeEach(() => jest.clearAllMocks())

describe('uploadFile', () => {
  it('calls PutObjectCommand with correct params', async () => {
    mockSend.mockResolvedValue({})
    const buf = Buffer.from('hello')
    await uploadFile('projects/p1/file.pdf', buf, 'application/pdf')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.Key).toBe('projects/p1/file.pdf')
    expect(cmd.Body).toBe(buf)
    expect(cmd.ContentType).toBe('application/pdf')
  })
})

describe('deleteFile', () => {
  it('calls DeleteObjectCommand with correct key', async () => {
    mockSend.mockResolvedValue({})
    await deleteFile('projects/p1/file.pdf')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.Key).toBe('projects/p1/file.pdf')
  })
})

describe('getPresignedDownloadUrl', () => {
  it('calls getSignedUrl and returns the URL', async () => {
    mockGetSignedUrl.mockResolvedValue('https://example.com/signed')
    const url = await getPresignedDownloadUrl('projects/p1/file.pdf')
    expect(url).toBe('https://example.com/signed')
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
  })
})
