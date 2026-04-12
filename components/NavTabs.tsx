'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Guides', href: '/guides' },
  { label: 'Groups', href: '/groups' },
  { label: 'Calendar', href: '/calendar' },
]

export default function NavTabs() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1">
      {tabs.map(({ label, href }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="relative px-3 py-1 text-sm font-medium transition-colors"
            style={{
              color: active ? 'var(--foreground)' : 'var(--muted)',
            }}
          >
            {label}
            {active && (
              <span
                className="absolute bottom-0 left-3 right-3"
                style={{
                  height: 1.5,
                  background: 'var(--foreground)',
                  borderRadius: 2,
                }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}
