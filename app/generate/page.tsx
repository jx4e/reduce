'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { peekPending, clearPending } from '@/lib/pendingGeneration'
import type { GenerateEvent } from '@/app/api/guides/generate/route'

const STAGES = [
  {
    title: 'Reading your files…',
    description: 'Extracting text and structure from your uploads',
  },
  {
    title: 'Analyzing your material…',
    description: 'Breaking down structure and key concepts',
  },
  {
    title: 'Writing your guide…',
    description: 'Generating sections, examples, and explanations',
  },
  {
    title: 'Finishing up…',
    description: 'Assembling the final guide',
  },
]

const STAGE_INDEX: Record<string, number> = {
  parsing: 0,
  analyzing: 1,
  writing: 2,
  rendering: 3,
}

// Progress bar settles here while each stage is active (just below next band start)
const STAGE_SETTLE = [18, 47, 82, 97]

export default function GeneratePage() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runGeneration = useCallback(async () => {
    setError(null)
    setCurrentStage(0)
    setProgress(0)
    setIsDone(false)

    const pending = peekPending()
    if (!pending) {
      router.replace('/guides')
      return
    }

    try {
      const formData = new FormData()
      pending.files.forEach(f => formData.append('files', f))
      formData.append('mode', pending.mode)
      if (pending.projectId) formData.append('projectId', pending.projectId)
      if (pending.storedFileIds?.length) formData.append('storedFileIds', pending.storedFileIds.join(','))
      if (pending.description) formData.append('description', pending.description)
      if (pending.customTitle) formData.append('customTitle', pending.customTitle)

      const res = await fetch('/api/guides/generate', { method: 'POST', body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(body.error ?? 'Generation failed')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event: GenerateEvent = JSON.parse(line.slice(6))

          if (event.type === 'stage') {
            const idx = STAGE_INDEX[event.stage] ?? 0
            setCurrentStage(idx)
            setProgress(STAGE_SETTLE[idx])
          } else if (event.type === 'done') {
            setProgress(100)
            setIsDone(true)
            clearPending()
            navTimeoutRef.current = setTimeout(() => router.push(`/guide/${event.guideId}`), 600)
            return
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [router])

  useEffect(() => {
    if (started.current) return
    started.current = true
    runGeneration()
  }, [runGeneration])

  useEffect(() => {
    return () => {
      if (navTimeoutRef.current !== null) clearTimeout(navTimeoutRef.current)
    }
  }, [])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Generation failed
        </p>
        <p className="text-xs max-w-sm" style={{ color: 'var(--muted)' }}>
          {error}
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={runGeneration}
            className="rounded-full px-5 py-2 text-xs font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Retry
          </button>
          <Link
            href="/guides"
            onClick={clearPending}
            className="text-xs font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            ← Start over
          </Link>
        </div>
      </div>
    )
  }

  const title = isDone ? 'Done!' : STAGES[currentStage].title
  const description = isDone
    ? 'Redirecting you to your guide…'
    : STAGES[currentStage].description

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div
          className="h-[3px] rounded-full overflow-hidden"
          style={{ background: 'var(--border)' }}
        >
          <div
            data-testid="progress-bar"
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--accent), #a78bfa)',
              transition: 'width 1.5s ease-out',
            }}
          />
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Stage {currentStage + 1} of {STAGES.length}
      </p>
    </div>
  )
}
