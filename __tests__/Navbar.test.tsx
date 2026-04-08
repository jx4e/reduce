import { render, screen } from '@testing-library/react'
import Navbar from '@/components/Navbar'

describe('Navbar', () => {
  it('renders the brand name', () => {
    render(<Navbar />)
    expect(screen.getByText('reduce')).toBeInTheDocument()
  })

  it('renders a sign in link when not authenticated', () => {
    render(<Navbar />)
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toBeInTheDocument()
  })
})
