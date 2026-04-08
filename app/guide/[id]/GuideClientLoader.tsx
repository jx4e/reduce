'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import GuideView from './GuideView'
import type { Guide } from '@/types/guide'

export default function GuideClientLoader({ id }: { id: string }) {
  const [guide, setGuide] = useState<Guide | null | 'not-found'>(null)

  useEffect(() => {
    const stored = localStorage.getItem(id)
    if (stored) {
      try {
        setGuide(JSON.parse(stored) as Guide)
      } catch {
        setGuide('not-found')
      }
    } else {
      setGuide('not-found')
    }
  }, [id])

  if (guide === null) {
    // Still loading from localStorage (first render)
    return null
  }

  if (guide === 'not-found') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-sm font-semibold">Guide not found</p>
        <Link href="/" className="text-xs" style={{ color: 'var(--accent)' }}>
          ← Back to home
        </Link>
      </div>
    )
  }

  return <GuideView guide={guide} />
}
