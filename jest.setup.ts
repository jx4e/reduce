import '@testing-library/jest-dom'

// Polyfill TextEncoder/TextDecoder for jsdom (not available in older jsdom versions).
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Guard: window/HTMLElement are only available in jsdom environment.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = jest.fn()

  // jsdom's File shim lacks arrayBuffer() and text(); replace with Node's implementation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  global.File = require('buffer').File
}
