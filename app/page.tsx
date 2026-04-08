'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'
import GuideCard from '@/components/GuideCard'
import type { GuideCardData, GuideMode } from '@/types/guide'

const MOCK_GUIDES: GuideCardData[] = [
  { id: '1', title: 'Electromagnetism — Maxwell\'s Equations', createdAt: 'Apr 5, 2026', mode: 'math-cs' },
  { id: '2', title: 'The French Revolution: Causes and Consequences', createdAt: 'Apr 3, 2026', mode: 'humanities' },
  { id: '3', title: 'Data Structures: Trees and Graphs', createdAt: 'Apr 1, 2026', mode: 'math-cs' },
]

export default function HomePage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')

  function handleGenerate() {
    if (files.length === 0) return
    router.push('/generate')
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-10">

        {/* Upload section */}
        <section className="flex flex-col gap-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload your material
          </h1>

          <UploadZone onFilesChange={setFiles} />

          {/* Mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Mode:</span>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {(['math-cs', 'humanities'] as GuideMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-4 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: mode === m ? 'var(--accent)' : 'var(--surface)',
                    color: mode === m ? '#fff' : 'var(--muted)',
                  }}
                >
                  {m === 'math-cs' ? 'Math / CS' : 'Humanities'}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={files.length === 0}
            className="self-center flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Generate Guide →
          </button>
        </section>

        {/* Recent guides */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Recent Guides
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MOCK_GUIDES.map(guide => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
