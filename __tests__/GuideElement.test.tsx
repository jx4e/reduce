import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuideElement from '@/components/GuideElement'
import type { ContentElement } from '@/types/guide'

const paragraphElement: ContentElement = {
  id: 'el-1',
  type: 'paragraph',
  content: 'Maxwell\'s equations describe electromagnetism.',
}

const formulaElement: ContentElement = {
  id: 'el-2',
  type: 'formula',
  content: '\\nabla \\cdot E = \\rho / \\epsilon_0',
}

describe('GuideElement', () => {
  it('renders paragraph content', () => {
    render(<GuideElement element={paragraphElement} onAsk={() => {}} />)
    expect(screen.getByText(/Maxwell's equations/)).toBeInTheDocument()
  })

  it('shows ask button on hover', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} onAsk={() => {}} />)
    const container = screen.getByTestId('guide-element-el-1')
    await user.hover(container)
    expect(screen.getByRole('button', { name: /ask/i })).toBeVisible()
  })

  it('shows popover when ask button is clicked', async () => {
    const user = userEvent.setup()
    render(<GuideElement element={paragraphElement} onAsk={() => {}} />)
    const container = screen.getByTestId('guide-element-el-1')
    await user.hover(container)
    await user.click(screen.getByRole('button', { name: /ask/i }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls onAsk with element and question when form submitted', async () => {
    const user = userEvent.setup()
    const onAsk = jest.fn()
    render(<GuideElement element={paragraphElement} onAsk={onAsk} />)
    const container = screen.getByTestId('guide-element-el-1')
    await user.hover(container)
    await user.click(screen.getByRole('button', { name: /ask/i }))
    await user.type(screen.getByRole('textbox'), 'What does this mean?')
    await user.click(screen.getByRole('button', { name: /submit/i }))
    expect(onAsk).toHaveBeenCalledWith(paragraphElement, 'What does this mean?')
  })
})
