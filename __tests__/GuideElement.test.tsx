import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuideElement from '@/components/GuideElement'
import type { ContentElement } from '@/types/guide'

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

jest.mock('@/hooks/useElementChat', () => ({
  useElementChat: jest.fn().mockReturnValue({
    messages: [],
    loading: false,
    send: jest.fn(),
  }),
}))

const paragraphElement: ContentElement = {
  id: 'el-1',
  type: 'paragraph',
  content: "Maxwell's equations describe electromagnetism.",
}

describe('GuideElement', () => {
  it('renders paragraph content', () => {
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    expect(screen.getByText(/Maxwell's equations/)).toBeInTheDocument()
  })

  it('shows context menu on right-click', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)
    await user.pointer({ keys: '[MouseRight]', target: content })
    expect(screen.getByText('Ask about this')).toBeInTheDocument()
  })

  it('opens chat modal when Ask about this is clicked', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)
    await user.pointer({ keys: '[MouseRight]', target: content })
    await user.click(screen.getByText('Ask about this'))
    expect(screen.getByPlaceholderText(/what does this mean/i)).toBeInTheDocument()
  })

  it('opens context menu after a 500ms long-press', () => {
    jest.useFakeTimers()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)

    fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
    expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

    act(() => { jest.advanceTimersByTime(500) })
    expect(screen.getByText('Ask about this')).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('does not open context menu if touch ends before 500ms', () => {
    jest.useFakeTimers()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    const content = screen.getByText(/Maxwell's equations/)

    fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(content)
    act(() => { jest.advanceTimersByTime(500) })
    expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

    jest.useRealTimers()
  })

  it('calls send with question when form submitted', async () => {
    const mockSend = jest.fn()
    const { useElementChat } = jest.requireMock('@/hooks/useElementChat')
    useElementChat.mockReturnValue({ messages: [], loading: false, send: mockSend })

    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} guideId="guide-1" />)
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText(/Maxwell's equations/) })
    await user.click(screen.getByText('Ask about this'))
    await user.type(screen.getByPlaceholderText(/what does this mean/i), 'What does this mean?')
    await user.click(screen.getByRole('button', { name: /submit question/i }))
    expect(mockSend).toHaveBeenCalledWith('What does this mean?')
  })
})
