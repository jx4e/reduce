import '@testing-library/jest-dom'

window.HTMLElement.prototype.scrollIntoView = jest.fn()

// jsdom's File shim lacks arrayBuffer() and text(); replace with Node's implementation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
global.File = require('buffer').File
