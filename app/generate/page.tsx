'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Stepper from '@/components/Stepper'
import { consumePending } from '@/lib/pendingGeneration'
import { saveGuide } from '@/lib/guideStorage'
import type { GenerateEvent } from '@/app/api/guides/generate/route'

const STAGES = ['Parsing', 'Analyzing', 'Writing', 'Rendering']

const STAGE_INDEX: Record<string, number> = {
  parsing: 0,
  analyzing: 1,
  writing: 2,
  rendering: 3,
}

export default function GeneratePage() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const pending = consumePending()
    if (!pending) {
      router.replace('/')
      return
    }

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

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // keep incomplete last line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const event: GenerateEvent = JSON.parse(line.slice(6))

            if (event.type === 'stage') {
              setCurrentStage(STAGE_INDEX[event.stage] ?? 0)
            } else if (event.type === 'done') {
              setCurrentStage(STAGES.length - 1)
              saveGuide(event.guide)
              router.push(`/guide/${event.guide.id}`)
              return
            } else if (event.type === 'error') {
              throw new Error(event.message)
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <Link href="/" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
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
