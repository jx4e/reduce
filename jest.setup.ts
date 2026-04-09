import '@testing-library/jest-dom'

// Guard: window/HTMLElement are only available in jsdom environment.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = jest.fn()

  // jsdom's File shim lacks arrayBuffer() and text(); replace with Node's implementation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  global.File = require('buffer').File
}
