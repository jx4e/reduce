import { render, screen, waitFor } from '@testing-library/react'
import GuideClientLoader from '@/app/guide/[id]/GuideClientLoader'
import type { Guide } from '@/types/guide'

// Mock GuideView so we don't render its full tree in jsdom
jest.mock('@/app/guide/[id]/GuideView', () => ({
  __esModule: true,
  default: ({ guide }: { guide: Guide }) => <div>{guide.title}</div>,
}))

const MOCK_GUIDE: Guide = {
  id: 'test-123',
  title: 'Test Guide',
  mode: 'math-cs',
  createdAt: 'Apr 8, 2026',
  sections: [
    {
      id: 's1',
      heading: 'Introduction',
      elements: [{ id: 'e1', type: 'paragraph', content: 'Hello world' }],
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
})

it('renders the guide title when found in localStorage', async () => {
  localStorage.setItem('test-123', JSON.stringify(MOCK_GUIDE))
  render(<GuideClientLoader id="test-123" />)
  await waitFor(() => expect(screen.getByText('Test Guide')).toBeInTheDocument())
})

it('shows a not-found message when the guide is missing from localStorage', async () => {
  render(<GuideClientLoader id="missing-id" />)
  await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
})
