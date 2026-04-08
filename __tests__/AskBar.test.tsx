// __tests__/AskBar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AskBar from '@/components/AskBar'
import type { ContentElement, ChatMessage } from '@/types/guide'

const mockMessages: ChatMessage[] = [
  { id: 'm1', role: 'user', content: 'What is this?' },
  { id: 'm2', role: 'assistant', content: 'This is an explanation.' },
]

describe('AskBar', () => {
  it('renders the ask input', () => {
    render(<AskBar messages={[]} onSend={() => {}} />)
    expect(screen.getByPlaceholderText(/ask anything/i)).toBeInTheDocument()
  })

  it('does not show chat history when no messages', () => {
    render(<AskBar messages={[]} onSend={() => {}} />)
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  it('shows chat history when messages exist', () => {
    render(<AskBar messages={mockMessages} onSend={() => {}} />)
    expect(screen.getByRole('log')).toBeInTheDocument()
    expect(screen.getByText('What is this?')).toBeInTheDocument()
    expect(screen.getByText('This is an explanation.')).toBeInTheDocument()
  })

  it('calls onSend and clears input on submit', async () => {
    const user = userEvent.setup()
    const onSend = jest.fn()
    render(<AskBar messages={[]} onSend={onSend} />)
    const input = screen.getByPlaceholderText(/ask anything/i)
    await user.type(input, 'Explain this concept')
    await user.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith('Explain this concept', undefined)
    expect(input).toHaveValue('')
  })

  it('shows context tag when contextElement is set', () => {
    const el: ContentElement = { id: 'el-1', type: 'paragraph', content: 'Some text' }
    render(<AskBar messages={[]} onSend={() => {}} contextElement={el} />)
    expect(screen.getByText(/re:/i)).toBeInTheDocument()
  })
})
