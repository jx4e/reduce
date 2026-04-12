'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'

interface Props {
  userId: string
  userName?: string | null
  userEmail?: string | null
}

export default function NavUserMenu({ userId, userName, userEmail }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80 focus:outline-none"
        aria-label="User menu"
        aria-expanded={open}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://api.dicebear.com/9.x/shapes/svg?seed=${userId}`}
          alt="avatar"
          className="w-7 h-7 rounded-full"
        />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-md py-1 z-50"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            animation: 'dropdown-in 0.12s ease',
          }}
        >
          {(userName || userEmail) && (
            <div
              className="px-3 py-2 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              {userName && (
                <div className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {userName}
                </div>
              )}
              {userEmail && (
                <div className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
                  {userEmail}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            Sign out
          </button>
        </div>
      )}

      <style>{`
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  )
}
