import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import SignOutButton from './SignOutButton'
import { auth } from '@/auth'

export default async function Navbar() {
  const session = await auth()

  return (
    <nav
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b px-6"
      style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight"
        style={{ color: 'var(--foreground)' }}
      >
        tldr.
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {session?.user ? (
          <div className="flex items-center gap-4">
            <Link
              href="/groups"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--muted)' }}
            >
              Groups
            </Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/9.x/shapes/svg?seed=${session.user.id}`}
              alt="avatar"
              className="w-7 h-7 rounded-full"
            />
            <SignOutButton />
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--muted)' }}
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  )
}
