'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Stepper from '@/components/Stepper'
import { consumePending } from '@/lib/pendingGeneration'
import type { Guide } from '@/types/guide'

const STAGES = ['Parsing', 'Analyzing', 'Writing', 'Rendering']

export default function GeneratePage() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Guard against double-invocation in React Strict Mode
    if (started.current) return
    started.current = true

    const pending = consumePending()
    if (!pending) {
      router.replace('/')
      return
    }

    // Animate the stepper while the fetch runs
    const interval = setInterval(() => {
      setCurrentStage(s => Math.min(s + 1, STAGES.length - 1))
    }, 1500)

    // Run the real generation
    ;(async () => {
      try {
        const formData = new FormData()
        pending.files.forEach(f => formData.append('files', f))
        formData.append('mode', pending.mode)

        const res = await fetch('/api/guides/generate', { method: 'POST', body: formData })
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Generation failed' }))
          throw new Error(body.error ?? 'Generation failed')
        }

        const guide: Guide = await res.json()
        localStorage.setItem(guide.id, JSON.stringify(guide))
        router.push(`/guide/${guide.id}`)
      } catch (err) {
        clearInterval(interval)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })()

    return () => clearInterval(interval)
  }, [router])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Generation failed
        </p>
        <p className="text-xs max-w-sm" style={{ color: 'var(--muted)' }}>
          {error}
        </p>
        <Link
          href="/"
          className="text-xs font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          ← Try again
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Generating your guide…
      </p>
      <Stepper stages={STAGES} currentStage={currentStage} />
    </div>
  )
}
