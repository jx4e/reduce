import { render, screen, within } from '@testing-library/react'
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

  it('opens the TOC sheet when Contents is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /contents/i }))
    expect(screen.getByRole('heading', { name: /contents/i })).toBeInTheDocument()
    const sheet = screen.getByTestId('mobile-toc-section-list')
    expect(within(sheet).getByText('1. Introduction')).toBeInTheDocument()
    expect(within(sheet).getByText('2. Chapter Two')).toBeInTheDocument()
  })

  it('closes the TOC sheet when a section link is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /contents/i }))
    await user.click(within(screen.getByTestId('mobile-toc-section-list')).getByText('1. Introduction'))
    expect(screen.queryByRole('heading', { name: /contents/i })).not.toBeInTheDocument()
  })

  it('closes the TOC sheet when Guide button is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /contents/i }))
    await user.click(screen.getByRole('button', { name: /guide/i }))
    expect(screen.queryByRole('heading', { name: /contents/i })).not.toBeInTheDocument()
  })

  it('opens the chat sheet when Chat is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /^chat$/i }))
    expect(screen.getByRole('heading', { name: /^ask$/i })).toBeInTheDocument()
    expect(within(screen.getByTestId('mobile-chat-sheet')).getByPlaceholderText(/ask…/i)).toBeInTheDocument()
  })

  it('closes the chat sheet when Guide button is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /^chat$/i }))
    await user.click(screen.getByRole('button', { name: /guide/i }))
    expect(screen.queryByRole('heading', { name: /^ask$/i })).not.toBeInTheDocument()
  })

  it('closes the chat sheet when backdrop is tapped', async () => {
    const user = userEvent.setup()
    render(<GuideView guide={MOCK_GUIDE} />)

    await user.click(screen.getByRole('button', { name: /^chat$/i }))
    await user.click(screen.getByTestId('chat-sheet-backdrop'))
    expect(screen.queryByRole('heading', { name: /^ask$/i })).not.toBeInTheDocument()
  })
})
