import { render, screen } from '@testing-library/react'
import Navbar from '@/components/Navbar'

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/components/SignOutButton', () => ({
  __esModule: true,
  default: () => <button>Sign out</button>,
}))

import { auth } from '@/auth'

describe('Navbar', () => {
  it('renders the brand name', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    render(await Navbar())
    expect(screen.getByText('tldr.')).toBeInTheDocument()
  })

  it('renders sign in link when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    render(await Navbar())
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders avatar and sign out when authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', name: 'Jake' } })
    render(await Navbar())
    expect(screen.getByRole('img', { name: /avatar/i })).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('renders Groups link when authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', name: 'Jake' } })
    render(await Navbar())
    expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument()
  })
})
