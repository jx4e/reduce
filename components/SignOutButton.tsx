'use client'

import { signOut } from 'next-auth/react'

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-sm transition-colors hover:opacity-80"
      style={{ color: 'var(--muted)' }}
    >
      Sign out
    </button>
  )
}
