import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import GroupsPage from '@/app/groups/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] })
})

describe('GroupsPage (/groups)', () => {
  it('renders the Groups heading', async () => {
    render(<GroupsPage />)
    await waitFor(() => {
      expect(screen.getByText(/groups/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no groups exist', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] })
    render(<GroupsPage />)
    await waitFor(() => {
      expect(screen.getByText(/no groups yet/i)).toBeInTheDocument()
    })
  })

  it('renders group cards when groups exist', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'p1', name: 'Bio Notes', createdAt: 'Apr 11, 2026', fileCount: 2, guideCount: 3 },
      ],
    })
    render(<GroupsPage />)
    await waitFor(() => {
      expect(screen.getByText('Bio Notes')).toBeInTheDocument()
    })
  })

  it('shows new group form when button is clicked', async () => {
    render(<GroupsPage />)
    await waitFor(() => screen.getByText(/new group/i))
    fireEvent.click(screen.getByText(/new group/i))
    expect(screen.getByPlaceholderText(/group name/i)).toBeInTheDocument()
  })
})
