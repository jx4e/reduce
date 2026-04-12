import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import GroupPageClient from '@/app/groups/[id]/GroupPageClient'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/pendingGeneration', () => ({
  setPending: jest.fn(),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const mockProject = {
  id: 'p1',
  name: 'Bio Notes',
  createdAt: 'Apr 11, 2026',
  files: [
    { id: 'f1', projectId: 'p1', name: 'chapter1.pdf', size: 102400, mimeType: 'application/pdf', storageKey: 'projects/p1/f1.pdf', uploadedAt: 'Apr 11, 2026' },
  ],
  guides: [
    { id: 'g1', title: 'Bio Guide', mode: 'humanities', createdAt: 'Apr 11, 2026' },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true, json: async () => mockProject })
})

describe('GroupPageClient', () => {
  it('renders the project name', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Bio Notes')).toBeInTheDocument()
    })
  })

  it('renders stored files', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('chapter1.pdf')).toBeInTheDocument()
    })
  })

  it('renders guide cards', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Bio Guide')).toBeInTheDocument()
    })
  })

  it('shows generate section with stored file checkbox', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByLabelText('chapter1.pdf')).toBeInTheDocument()
    })
  })
})
