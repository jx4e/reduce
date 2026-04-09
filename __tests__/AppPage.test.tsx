import { render, screen, waitFor } from '@testing-library/react'
import AppPage from '@/app/app/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/pendingGeneration', () => ({
  setPending: jest.fn(),
}))

global.fetch = jest.fn().mockResolvedValue({
  json: async () => [],
}) as jest.Mock

describe('AppPage (/app)', () => {
  it('renders the upload zone', async () => {
    render(<AppPage />)
    await waitFor(() => {
      expect(screen.getByText(/upload/i)).toBeInTheDocument()
    })
  })

  it('renders the mode toggle', async () => {
    render(<AppPage />)
    await waitFor(() => {
      expect(screen.getByText('Math / CS')).toBeInTheDocument()
      expect(screen.getByText('Humanities')).toBeInTheDocument()
    })
  })
})
