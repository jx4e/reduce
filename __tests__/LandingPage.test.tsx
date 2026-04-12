import { render, screen } from '@testing-library/react'
import LandingPage from '@/app/page'

jest.mock('@/auth', () => ({
  auth: jest.fn().mockResolvedValue(null),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

jest.mock('@/components/LandingDemo', () => ({
  __esModule: true,
  default: () => <div data-testid="landing-demo" />,
}))

import { redirect } from 'next/navigation'
import { auth } from '@/auth'

describe('LandingPage (/)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(auth as jest.Mock).mockResolvedValue(null)
  })

  it('renders the hero headline', async () => {
    render(await LandingPage())
    expect(screen.getByText(/upload your notes/i)).toBeInTheDocument()
    expect(screen.getByText(/get the tldr/i)).toBeInTheDocument()
  })

  it('renders Start studying CTA linking to /register', async () => {
    render(await LandingPage())
    const cta = screen.getByRole('link', { name: /start studying/i })
    expect(cta).toHaveAttribute('href', '/register')
  })

  it('renders Sign in link linking to /login', async () => {
    render(await LandingPage())
    const signIn = screen.getAllByRole('link', { name: /sign in/i })
    expect(signIn[0]).toHaveAttribute('href', '/login')
  })

  it('renders the LandingDemo component', async () => {
    render(await LandingPage())
    expect(screen.getByTestId('landing-demo')).toBeInTheDocument()
  })

  it('redirects to /dashboard when authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    await LandingPage()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })
})
