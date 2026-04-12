import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/pendingGeneration', () => ({
  setPending: jest.fn(),
}))

function mockFetch(usagePayload: { totalTokens: number; estimatedCostUsd: number } | null) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url === '/api/guides') return Promise.resolve({ json: async () => [] })
    if (url === '/api/projects') return Promise.resolve({ json: async () => [] })
    if (url === '/api/usage') {
      if (usagePayload === null) return Promise.reject(new Error('network error'))
      return Promise.resolve({ json: async () => usagePayload })
    }
    return Promise.resolve({ json: async () => ({}) })
  })
}

describe('DashboardPage usage stats', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders Tokens label', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Tokens')).toBeInTheDocument())
  })

  it('renders formatted token count', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('42,000')).toBeInTheDocument())
  })

  it('renders Est. Cost label', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('Est. Cost')).toBeInTheDocument())
  })

  it('renders formatted cost', async () => {
    mockFetch({ totalTokens: 42000, estimatedCostUsd: 0.0042 })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('$0.0042')).toBeInTheDocument())
  })

  it('shows — for tokens when usage fetch fails', async () => {
    mockFetch(null)
    render(<DashboardPage />)
    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows $0.00 for cost when usage fetch fails', async () => {
    mockFetch(null)
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('$0.00')).toBeInTheDocument())
  })
})
