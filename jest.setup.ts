import '@testing-library/jest-dom'

// Stub storage env vars so lib/storage.ts guards don't throw in tests.
// The S3Client is mocked in storage tests; these values are never sent to AWS.
process.env.STORAGE_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID ?? 'test-access-key'
process.env.STORAGE_SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY ?? 'test-secret-key'
process.env.STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET_NAME ?? 'test-bucket'

// Polyfill TextEncoder/TextDecoder for jsdom (not available in older jsdom versions).
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Polyfill ReadableStream for jsdom (not available in Node's jsdom environment).
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream } = require('stream/web')
  global.ReadableStream = ReadableStream
}

// Guard: window/HTMLElement are only available in jsdom environment.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = jest.fn()

  // jsdom's File shim lacks arrayBuffer() and text(); replace with Node's implementation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  global.File = require('buffer').File
}
