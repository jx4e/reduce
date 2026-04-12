'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'
import GuideCard from '@/components/GuideCard'
import GenerateAdvancedOptions from '@/components/GenerateAdvancedOptions'
import type { GuideCardData, GuideMode } from '@/types/guide'
import { setPending } from '@/lib/pendingGeneration'

export default function AppPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')
  const [guides, setGuides] = useState<GuideCardData[]>([])
  const [search, setSearch] = useState('')
  const [advanced, setAdvanced] = useState({ description: '', customTitle: '' })

  useEffect(() => {
    fetch('/api/guides')
      .then(r => r.json())
      .then(setGuides)
      .catch(() => {})
  }, [])

  const filteredGuides = guides.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase())
  )

  function handleGenerate() {
    if (files.length === 0) return
    setPending({ files, mode, ...advanced })
    router.push('/generate')
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-10">

        {/* Upload section */}
        <section className="flex flex-col gap-6">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
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

          <GenerateAdvancedOptions onChange={setAdvanced} />

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

        {/* Guides list */}
        {guides.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest shrink-0" style={{ color: 'var(--muted)' }}>
                Your Guides
              </h2>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search guides…"
                className="rounded border px-3 py-1 text-sm outline-none w-48"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            {filteredGuides.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredGuides.map(guide => <GuideCard key={guide.id} guide={guide} />)}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No guides match &ldquo;{search}&rdquo;.</p>
            )}
          </section>
        )}

      </div>
    </div>
  )
}
