import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b px-6"
         style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
      <Link href="/"
            className="text-sm font-semibold tracking-tight"
            style={{ color: 'var(--foreground)' }}>
        reduce
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link href="/login"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--muted)' }}>
          Sign in
        </Link>
      </div>
    </nav>
  )
}
