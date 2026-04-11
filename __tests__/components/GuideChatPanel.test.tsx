// __tests__/components/GuideChatPanel.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuideChatPanel } from '@/components/guide/GuideChatPanel'
import type { Guide } from '@/types/guide'

const guide: Guide = {
  id: 'g1',
  title: 'Physics 101',
  mode: 'math-cs',
  createdAt: '2026-04-10',
  sections: [{ id: 's1', heading: 'Intro', elements: [] }],
}

jest.mock('@/hooks/useGuideChat', () => ({
  useGuideChat: () => ({
    messages: [],
    loading: false,
    input: '',
    setInput: jest.fn(),
    send: jest.fn(),
    chatEndRef: { current: null },
    inputRef: { current: null },
  }),
}))

describe('GuideChatPanel', () => {
  it('renders the Ask placeholder in mobile sheet when mobileOpen', () => {
    render(
      <GuideChatPanel
        guide={guide}
        mobileOpen={true}
        onMobileClose={() => {}}
      />
    )
    expect(screen.getByTestId('mobile-chat-sheet')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/ask…/i)).toBeInTheDocument()
  })

  it('calls onMobileClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onMobileClose = jest.fn()
    render(
      <GuideChatPanel
        guide={guide}
        mobileOpen={true}
        onMobileClose={onMobileClose}
      />
    )
    await user.click(screen.getByTestId('chat-sheet-backdrop'))
    expect(onMobileClose).toHaveBeenCalled()
  })

  it('does not render the mobile sheet when mobileOpen is false', () => {
    render(
      <GuideChatPanel
        guide={guide}
        mobileOpen={false}
        onMobileClose={() => {}}
      />
    )
    expect(screen.queryByTestId('mobile-chat-sheet')).not.toBeInTheDocument()
  })
})
