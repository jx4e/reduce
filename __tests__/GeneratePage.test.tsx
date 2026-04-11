import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import GeneratePage from '@/app/generate/page'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

const mockPeekPending = jest.fn()
const mockClearPending = jest.fn()

jest.mock('@/lib/pendingGeneration', () => ({
  peekPending: () => mockPeekPending(),
  clearPending: () => mockClearPending(),
}))

/** Build a minimal fake SSE stream from an array of GenerateEvent objects. */
function makeStream(...events: object[]) {
  const text = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
  let consumed = false
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (consumed) return { done: true as const, value: undefined }
          consumed = true
          return { done: false as const, value: new TextEncoder().encode(text) }
        },
      }),
    },
  }
}

const PENDING = {
  files: [new File(['x'], 'test.pdf', { type: 'application/pdf' })],
  mode: 'math-cs' as const,
}

describe('GeneratePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPeekPending.mockReturnValue(PENDING)
  })

  // --- Loading state ---

  it('shows the initial stage title', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) // never resolves
    render(<GeneratePage />)
    expect(screen.getByText('Reading your files…')).toBeInTheDocument()
  })

  it('shows the initial stage description', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<GeneratePage />)
    expect(screen.getByText('Extracting text and structure from your uploads')).toBeInTheDocument()
  })

  it('renders the progress bar element', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<GeneratePage />)
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
  })

  it('shows the stage counter', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<GeneratePage />)
    expect(screen.getByText('Stage 1 of 4')).toBeInTheDocument()
  })

  it('redirects to home when there is no pending data', async () => {
    mockPeekPending.mockReturnValue(null)
    global.fetch = jest.fn()
    render(<GeneratePage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  })

  it('advances stage title when a stage event arrives', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream(
        { type: 'stage', stage: 'analyzing' },
      )
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByText('Analyzing your material…')).toBeInTheDocument()
    )
  })

  // --- Done state ---

  it('shows Done! and navigates after 600ms on success', async () => {
    jest.useFakeTimers()
    const guide = {
      id: 'guide-abc',
      title: 'Test Guide',
      sections: [],
      mode: 'math-cs',
      createdAt: 'Apr 10, 2026',
    }
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream({ type: 'done', guide }))
      .mockResolvedValueOnce({ ok: true }) // save guide POST

    render(<GeneratePage />)

    await waitFor(() => expect(screen.getByText('Done!')).toBeInTheDocument())

    // Should NOT have navigated yet
    expect(mockPush).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(600) })
    expect(mockPush).toHaveBeenCalledWith('/guide/guide-abc')
    expect(mockClearPending).toHaveBeenCalled()

    jest.useRealTimers()
  })

  // --- Error state ---

  it('shows error heading when generation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'AI service unavailable' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByText('Generation failed')).toBeInTheDocument()
    )
  })

  it('shows the error message text', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'AI service unavailable' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByText('AI service unavailable')).toBeInTheDocument()
    )
  })

  it('shows a Retry button in the error state', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'Oops' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    )
  })

  it('shows a Start over link in the error state', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeStream({ type: 'error', message: 'Oops' })
    )
    render(<GeneratePage />)
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /start over/i })).toBeInTheDocument()
    )
  })

  it('clicking Retry re-runs generation', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream({ type: 'error', message: 'Failed' }))
      .mockReturnValueOnce(new Promise(() => {})) // second attempt hangs

    render(<GeneratePage />)
    await waitFor(() => screen.getByRole('button', { name: /retry/i }))

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('clicking Retry clears the error state', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream({ type: 'error', message: 'Failed' }))
      .mockReturnValueOnce(new Promise(() => {}))

    render(<GeneratePage />)
    await waitFor(() => screen.getByRole('button', { name: /retry/i }))

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.queryByText('Generation failed')).not.toBeInTheDocument()
    )
  })
})
