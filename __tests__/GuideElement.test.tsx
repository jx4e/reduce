import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuideElement from '@/components/GuideElement'
import type { ContentElement } from '@/types/guide'

// GuideElement uses createPortal — stub it for jsdom
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

const paragraphElement: ContentElement = {
  id: 'el-1',
  type: 'paragraph',
  content: "Maxwell's equations describe electromagnetism.",
}

const formulaElement: ContentElement = {
  id: 'el-2',
  type: 'formula',
  content: '\\nabla \\cdot E = \\rho / \\epsilon_0',
}

describe('GuideElement', () => {
  it('renders paragraph content', () => {
    render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={() => {}} onNoteChange={() => {}} />)
    expect(screen.getByText(/Maxwell's equations/)).toBeInTheDocument()
  })

  it('shows context menu on right-click', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={() => {}} onNoteChange={() => {}} />)
    const content = screen.getByText(/Maxwell's equations/)
    await user.pointer({ keys: '[MouseRight]', target: content })
    expect(screen.getByText('Ask about this')).toBeInTheDocument()
  })

  it('opens chat modal when Ask about this is clicked', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={() => {}} onNoteChange={() => {}} />)
    const content = screen.getByText(/Maxwell's equations/)
    await user.pointer({ keys: '[MouseRight]', target: content })
    await user.click(screen.getByText('Ask about this'))
    expect(screen.getByPlaceholderText(/what does this mean/i)).toBeInTheDocument()
  })

  it('opens context menu after a 500ms long-press', () => {
    jest.useFakeTimers()
    render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={() => {}} onNoteChange={() => {}} />)
    const content = screen.getByText(/Maxwell's equations/)

    fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
    expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

    act(() => { jest.advanceTimersByTime(500) })
    expect(screen.getByText('Ask about this')).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('does not open context menu if touch ends before 500ms', () => {
    jest.useFakeTimers()
    render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={() => {}} onNoteChange={() => {}} />)
    const content = screen.getByText(/Maxwell's equations/)

    fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(content)
    act(() => { jest.advanceTimersByTime(500) })
    expect(screen.queryByText('Ask about this')).not.toBeInTheDocument()

    jest.useRealTimers()
  })

  it('calls onAsk with element and question when form submitted', async () => {
    const user = userEvent.setup()
    const onAsk = jest.fn()
    render(<GuideElement element={paragraphElement} messages={[]} note="" onAsk={onAsk} onNoteChange={() => {}} />)
    const content = screen.getByText(/Maxwell's equations/)
    await user.pointer({ keys: '[MouseRight]', target: content })
    await user.click(screen.getByText('Ask about this'))
    await user.type(screen.getByPlaceholderText(/what does this mean/i), 'What does this mean?')
    await user.click(screen.getByRole('button', { name: /submit question/i }))
    expect(onAsk).toHaveBeenCalledWith(paragraphElement, 'What does this mean?')
  })
})
