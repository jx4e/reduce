'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationLoader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const prevPathname = useRef(pathname)

  // Show on link click, hide once new pathname has rendered
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http')) return
      setVisible(true)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      setVisible(false)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'var(--background)', animation: 'fade-in 0.1s ease-out' }}
    >
      <span
        className="text-2xl font-bold tracking-tight"
        style={{ color: 'var(--foreground)', animation: 'loading-pulse 1.2s ease-in-out infinite' }}
      >
        reduce
      </span>
    </div>
  )
}
