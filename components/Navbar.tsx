import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import NavTabs from './NavTabs'
import NavUserMenu from './NavUserMenu'
import { auth } from '@/auth'

export default async function Navbar() {
  const session = await auth()

  return (
    <nav
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b px-6"
      style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight"
          style={{ color: 'var(--foreground)' }}
        >
          tldr.
        </Link>
        {session?.user && <NavTabs />}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {session?.user ? (
          <NavUserMenu
            userId={session.user.id!}
            userName={session.user.name}
            userEmail={session.user.email}
          />
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
