import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuideView from '@/app/guide/[id]/GuideView'
import type { Guide } from '@/types/guide'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

jest.mock('@/components/GuideElement', () => ({
  __esModule: true,
  default: ({ element }: { element: { content: string } }) => <div>{element.content}</div>,
  MarkdownMessage: ({ content }: { content: string }) => <span>{content}</span>,
}))

const MOCK_GUIDE: Guide = {
  id: 'g1',
  title: 'Physics 101',
  mode: 'math-cs',
  createdAt: '2026-04-09',
  sections: [
    { id: 's1', heading: 'Introduction', elements: [{ id: 'e1', type: 'paragraph', content: 'Hello world' }] },
    { id: 's2', heading: 'Chapter Two', elements: [{ id: 'e2', type: 'paragraph', content: 'Second section' }] },
  ],
}

describe('GuideView — mobile bottom nav', () => {
  it('renders the bottom nav bar with three buttons', () => {
    render(<GuideView guide={MOCK_GUIDE} />)
    expect(screen.getByRole('button', { name: /contents/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guide/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
  })
})
