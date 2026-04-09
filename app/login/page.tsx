'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password')
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#ef4444', background: '#fef2f2' }}>
              {error}
            </p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Continue with Google
        </button>

        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium" style={{ color: 'var(--accent)' }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
