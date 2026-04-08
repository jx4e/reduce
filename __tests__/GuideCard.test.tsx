import { render, screen } from '@testing-library/react'
import GuideCard from '@/components/GuideCard'
import type { GuideCardData } from '@/types/guide'

const mockGuide: GuideCardData = {
  id: 'abc123',
  title: 'Introduction to Calculus',
  createdAt: 'Apr 5, 2026',
  mode: 'math-cs',
}

describe('GuideCard', () => {
  it('renders the guide title', () => {
    render(<GuideCard guide={mockGuide} />)
    expect(screen.getByText('Introduction to Calculus')).toBeInTheDocument()
  })

  it('renders the creation date', () => {
    render(<GuideCard guide={mockGuide} />)
    expect(screen.getByText('Apr 5, 2026')).toBeInTheDocument()
  })

  it('renders the mode badge', () => {
    render(<GuideCard guide={mockGuide} />)
    expect(screen.getByText('Math / CS')).toBeInTheDocument()
  })

  it('links to the guide page', () => {
    render(<GuideCard guide={mockGuide} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/guide/abc123')
  })

  it('renders Humanities badge for humanities mode', () => {
    render(<GuideCard guide={{ ...mockGuide, mode: 'humanities' }} />)
    expect(screen.getByText('Humanities')).toBeInTheDocument()
  })
})
