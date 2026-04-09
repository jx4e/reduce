import { render, screen, waitFor } from '@testing-library/react'
import GuideClientLoader from '@/app/guide/[id]/GuideClientLoader'
import type { Guide } from '@/types/guide'

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

beforeEach(() => jest.resetAllMocks())

it('renders the guide title when fetch succeeds', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(MOCK_GUIDE),
  } as Response)

  render(<GuideClientLoader id="test-123" />)
  await waitFor(() => expect(screen.getByText('Test Guide')).toBeInTheDocument())
  expect(fetch).toHaveBeenCalledWith('/api/guides/test-123')
})

it('shows a not-found message when fetch returns 404', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
  } as Response)

  render(<GuideClientLoader id="missing-id" />)
  await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
})
