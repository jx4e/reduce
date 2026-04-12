import { render, screen, waitFor } from '@testing-library/react'
import ThisWeekWidget from '@/components/calendar/ThisWeekWidget'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

global.fetch = jest.fn()

beforeEach(() => jest.clearAllMocks())

describe('ThisWeekWidget', () => {
  it('shows loading state initially', () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })
    render(<ThisWeekWidget />)
    // While loading, no events text should be shown
    expect(screen.queryByText(/nothing scheduled/i)).not.toBeInTheDocument()
  })

  it('shows empty state when no events', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })
    render(<ThisWeekWidget />)
    await waitFor(() => {
      expect(screen.getByText(/nothing scheduled/i)).toBeInTheDocument()
    })
  })

  it('renders events when present', async () => {
    const mockEvent = {
      id: 'ev-1',
      title: 'Exam 1',
      date: new Date().toISOString(),
      duration: null,
      type: 'exam',
      guideId: null,
      gcalEventId: null,
      notes: null,
      createdAt: new Date().toISOString(),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [mockEvent] })
    render(<ThisWeekWidget />)
    await waitFor(() => {
      expect(screen.getByText('Exam 1')).toBeInTheDocument()
    })
  })
})
