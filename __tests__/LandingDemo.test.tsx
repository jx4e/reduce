import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LandingDemo from '@/components/LandingDemo'

// GuideElement uses createPortal — stub it for jsdom
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

describe('LandingDemo', () => {
  it('renders the demo section heading', () => {
    render(<LandingDemo />)
    expect(screen.getByText(/from notes to guide/i)).toBeInTheDocument()
  })

  it('renders all four sample guide elements', () => {
    render(<LandingDemo />)
    // heading element content
    expect(screen.getByText('Binary Search Trees')).toBeInTheDocument()
    // paragraph element content
    expect(screen.getByText(/BST invariant/i)).toBeInTheDocument()
  })

  it('renders a Try it free link pointing to /register', () => {
    render(<LandingDemo />)
    const link = screen.getByRole('link', { name: /try it free/i })
    expect(link).toHaveAttribute('href', '/register')
  })

  describe('scripted response', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('typing a question and submitting calls the scripted onAsk handler', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<LandingDemo />)

      // Right-click the paragraph element to open context menu
      const paragraph = screen.getByText(/BST invariant/i)
      await user.pointer({ keys: '[MouseRight]', target: paragraph })

      // Click "Ask about this" in context menu
      await user.click(screen.getByText(/ask about this/i))

      // Type a question and submit
      const input = screen.getByPlaceholderText(/what does this mean/i)
      await user.type(input, 'explain this')
      await user.click(screen.getByRole('button', { name: /submit question/i }))

      // Advance timers to let scripted streaming complete
      act(() => { jest.runAllTimers() })

      expect(screen.getByText(/BST invariant is what makes/i)).toBeInTheDocument()
    })
  })
})
