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

  it('right-clicking an element opens the ask dialog', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    // Right-click the paragraph element to open context menu
    const paragraph = screen.getByText(/BST invariant/i)
    await user.pointer({ keys: '[MouseRight]', target: paragraph })

    // Click "Ask about this" in context menu
    await user.click(screen.getByText(/ask about this/i))

    // The ask dialog should open with an input
    expect(screen.getByPlaceholderText(/what does this mean/i)).toBeInTheDocument()
  })
})
