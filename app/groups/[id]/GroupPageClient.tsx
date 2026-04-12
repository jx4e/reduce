'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import GuideCard from '@/components/GuideCard'
import UploadZone from '@/components/UploadZone'
import GenerateAdvancedOptions from '@/components/GenerateAdvancedOptions'
import { setPending } from '@/lib/pendingGeneration'
import type { ProjectDetail, ProjectFile } from '@/types/project'
import type { GuideMode } from '@/types/guide'

export default function GroupPageClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')
  const [uploading, setUploading] = useState(false)
  const [advanced, setAdvanced] = useState({ description: '', customTitle: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then((data: ProjectDetail) => {
        setProject(data)
        setSelectedFileIds(new Set(data.files.map(f => f.id)))
      })
      .catch(() => {})
  }, [projectId])

  function toggleFile(id: string) {
    setSelectedFileIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteFile(file: ProjectFile) {
    const res = await fetch(`/api/projects/${projectId}/files/${file.id}`, { method: 'DELETE' })
    if (res.ok) {
      setProject(prev => prev ? { ...prev, files: prev.files.filter(f => f.id !== file.id) } : prev)
      setSelectedFileIds(prev => { const next = new Set(prev); next.delete(file.id); return next })
    }
  }

  async function handleAddFiles(files: File[]) {
    if (files.length === 0) return
    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      const res = await fetch(`/api/projects/${projectId}/files`, { method: 'POST', body: formData })
      if (res.ok) {
        const saved: ProjectFile[] = await res.json()
        setProject(prev => prev ? { ...prev, files: [...saved, ...prev.files] } : prev)
        setSelectedFileIds(prev => { const next = new Set(prev); saved.forEach(f => next.add(f.id)); return next })
      }
    } finally {
      setUploading(false)
    }
  }

  function handleGenerate() {
    if (selectedFileIds.size === 0 && newFiles.length === 0) return
    setPending({
      files: newFiles,
      mode,
      projectId,
      storedFileIds: Array.from(selectedFileIds),
      ...advanced,
    })
    router.push('/generate')
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-10">

        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>

        {/* Files section */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Files
          </h2>

          {project.files.length > 0 && (
            <ul className="flex flex-col gap-2">
              {project.files.map(f => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm truncate max-w-xs" style={{ color: 'var(--foreground)' }}>{f.name}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{formatBytes(f.size)} · {f.uploadedAt}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(f)}
                    className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                    style={{ color: 'var(--muted)' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              multiple
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                handleAddFiles(files)
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-opacity disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--surface)' }}
            >
              {uploading ? 'Uploading…' : '+ Add files'}
            </button>
          </div>
        </section>

        {/* Guides section */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Guides
          </h2>

          {project.guides.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {project.guides.map(guide => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          )}

          {/* Generate new guide */}
          <div
            className="flex flex-col gap-4 rounded-xl border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Generate a new guide</p>

            {project.files.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Include stored files:</p>
                {project.files.map(f => {
                  const dot = f.name.lastIndexOf('.')
                  const base = dot >= 0 ? f.name.slice(0, dot) : f.name
                  const ext = dot >= 0 ? f.name.slice(dot) : ''
                  return (
                    <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFileIds.has(f.id)}
                        onChange={() => toggleFile(f.id)}
                        aria-label={f.name}
                      />
                      <span style={{ color: 'var(--foreground)' }}><span>{base}</span><span>{ext}</span></span>
                    </label>
                  )
                })}
              </div>
            )}

            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Or upload additional files:</p>
              <UploadZone onFilesChange={setNewFiles} />
            </div>

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

            <button
              onClick={handleGenerate}
              disabled={selectedFileIds.size === 0 && newFiles.length === 0}
              className="self-start flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Generate Guide →
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
