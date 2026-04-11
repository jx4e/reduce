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

jest.mock('@/components/guide/GuideTOC', () => ({
  GuideTOC: ({ sections, mobileOpen, onMobileClose }: { sections: { id: string; heading: string }[], mobileOpen: boolean, onMobileClose: () => void }) => (
    mobileOpen ? (
      <div>
        <h2>Contents</h2>
        <div data-testid="mobile-toc-section-list">
          {sections.map((s, i) => (
            <a key={s.id} href={`#section-${s.id}`} onClick={onMobileClose}>{i + 1}. {s.heading}</a>
          ))}
        </div>
        <button onClick={onMobileClose} aria-label="Close contents" />
      </div>
    ) : null
  ),
}))

jest.mock('@/components/guide/GuideChatPanel', () => ({
  GuideChatPanel: ({ mobileOpen, onMobileClose }: { mobileOpen: boolean, onMobileClose: () => void }) => (
    mobileOpen ? (
      <div>
        <h2>Ask</h2>
        <div data-testid="mobile-chat-sheet">
          <input placeholder="Ask…" />
        </div>
        <div data-testid="chat-sheet-backdrop" onClick={onMobileClose} />
      </div>
    ) : null
  ),
}))

jest.mock('@/components/guide/GuideContent', () => ({
  GuideContent: () => <div data-testid="guide-content" />,
}))

jest.mock('@/hooks/useGuideScroll', () => ({
  useGuideScroll: (sections: { id: string }[]) => ({
    activeSection: sections[0]?.id ?? '',
    contentRef: { current: null },
    scrollToSection: jest.fn(),
  }),
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

  it('renders the guide title in the header', () => {
    render(<GuideView guide={MOCK_GUIDE} />)
    expect(screen.getByRole('heading', { level: 1, name: /physics 101/i })).toBeInTheDocument()
  })
})
