'use client'

import { useState } from 'react'
import type { CandidateEvent, EventType } from '@/types/calendar'

interface Props {
  onClose: () => void
  onImported: () => void
}

type Step = 'input' | 'review' | 'plan-review'

export default function ImportSyllabusModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [tab, setTab] = useState<'upload' | 'paste'>('upload')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidates, setCandidates] = useState<CandidateEvent[]>([])
  const [planCandidates, setPlanCandidates] = useState<CandidateEvent[]>([])
  const [error, setError] = useState('')

  async function handleExtract() {
    setExtracting(true)
    setError('')

    let res: Response
    if (tab === 'upload' && file) {
      const fd = new FormData()
      fd.append('file', file)
      res = await fetch('/api/calendar/extract', { method: 'POST', body: fd })
    } else {
      if (!text.trim()) { setError('Please paste some text first.'); setExtracting(false); return }
      res = await fetch('/api/calendar/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    }

    if (!res.ok) { setError('Extraction failed. Please try again.'); setExtracting(false); return }
    const data: CandidateEvent[] = await res.json()
    if (data.length === 0) { setError('No dates found. Try pasting more text.'); setExtracting(false); return }
    setCandidates(data)
    setStep('review')
    setExtracting(false)
  }

  function removeCandidate(i: number) {
    setCandidates(c => c.filter((_, idx) => idx !== i))
  }

  function updateCandidateTitle(i: number, title: string) {
    setCandidates(c => c.map((ev, idx) => idx === i ? { ...ev, title } : ev))
  }

  function updateCandidateDate(i: number, date: string) {
    setCandidates(c => c.map((ev, idx) => idx === i ? { ...ev, date } : ev))
  }

  function updateCandidateType(i: number, type: CandidateEvent['type']) {
    setCandidates(c => c.map((ev, idx) => idx === i ? { ...ev, type } : ev))
  }

  async function handleGeneratePlan() {
    setGenerating(true)
    setError('')
    const res = await fetch('/api/calendar/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: candidates }),
    })
    if (!res.ok) { setError('Plan generation failed.'); setGenerating(false); return }
    const sessions: CandidateEvent[] = await res.json()
    setPlanCandidates(sessions)
    setStep('plan-review')
    setGenerating(false)
  }

  function removePlanCandidate(i: number) {
    setPlanCandidates(p => p.filter((_, idx) => idx !== i))
  }

  async function handleSave(includePlan: boolean) {
    setSaving(true)
    const allEvents = includePlan ? [...candidates, ...planCandidates] : candidates
    const payload = allEvents.map(e => ({
      title: e.title,
      date: e.date.includes('T') ? e.date : `${e.date}T00:00:00.000Z`,
      duration: e.duration ?? null,
      type: e.type as EventType,
    }))
    const res = await fetch('/api/calendar/events/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) { setError('Failed to save events.'); setSaving(false); return }
    onImported()
  }

  const TYPE_OPTS: CandidateEvent['type'][] = ['exam', 'assignment', 'other']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-xl flex flex-col"
        style={{ background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}>
              {step === 'input' ? 'Import syllabus' : step === 'review' ? 'Review extracted events' : 'Review study plan'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {step === 'input'
                ? 'AI will extract dates and deadlines automatically'
                : step === 'review'
                ? 'Edit or remove events before adding to calendar'
                : 'Review generated study sessions'}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5 overflow-y-auto flex-1">

          {step === 'input' && (
            <>
              {/* Tab row */}
              <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: '1px solid var(--border)' }}>
                {(['upload', 'paste'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-1.5 font-medium"
                    style={{
                      background: tab === t ? 'var(--accent)' : 'var(--background)',
                      color: tab === t ? '#fff' : 'var(--muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'upload' ? 'Upload file' : 'Paste text'}
                  </button>
                ))}
              </div>

              {tab === 'upload' ? (
                <label
                  className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                  style={{ border: '1px dashed var(--border-hover)', padding: '32px 16px', textAlign: 'center' }}
                >
                  <span style={{ fontSize: 24 }}>📄</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {file ? file.name : 'Drop your syllabus here or click to browse'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--border-hover)' }}>PDF or TXT · up to 10 MB</span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.text"
                    className="sr-only"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : (
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste your syllabus text here..."
                  rows={8}
                  className="rounded-lg px-3 py-2 text-sm resize-none"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                />
              )}

              {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
            </>
          )}

          {step === 'review' && (
            <div className="flex flex-col gap-2">
              {candidates.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <select
                    value={ev.type}
                    onChange={e => updateCandidateType(i, e.target.value as CandidateEvent['type'])}
                    className="text-xs rounded px-1 py-0.5"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  >
                    {TYPE_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    value={ev.title}
                    onChange={e => updateCandidateTitle(i, e.target.value)}
                    className="flex-1 text-sm rounded px-2 py-0.5 min-w-0"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  />
                  <input
                    type="date"
                    value={ev.date.split('T')[0]}
                    onChange={e => updateCandidateDate(i, e.target.value)}
                    className="text-xs rounded px-2 py-0.5"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={() => removeCandidate(i)}
                    className="text-xs px-1"
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {candidates.length === 0 && (
                <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>No events remaining.</p>
              )}
              {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}
            </div>
          )}

          {step === 'plan-review' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {planCandidates.length} study sessions generated. Remove any you don&apos;t want.
              </p>
              {planCandidates.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                >
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface)', color: 'var(--muted)', flexShrink: 0 }}
                  >
                    study
                  </span>
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--foreground)' }}>{ev.title}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                    {new Date(ev.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                    {ev.duration ? ` · ${ev.duration}m` : ''}
                  </span>
                  <button
                    onClick={() => removePlanCandidate(i)}
                    className="text-xs px-1"
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {step === 'input' && (
            <>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Supports PDF and plain text</span>
              <button
                onClick={handleExtract}
                disabled={extracting || (tab === 'upload' && !file) || (tab === 'paste' && !text.trim())}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                {extracting ? 'Extracting…' : 'Extract dates with AI →'}
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {candidates.length} event{candidates.length !== 1 ? 's' : ''} found
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || candidates.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                  style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', cursor: 'pointer' }}
                >
                  {saving ? 'Saving…' : 'Add to calendar'}
                </button>
                <button
                  onClick={handleGeneratePlan}
                  disabled={generating || candidates.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  {generating ? 'Generating…' : 'Generate study plan →'}
                </button>
              </div>
            </>
          )}

          {step === 'plan-review' && (
            <>
              <button
                onClick={() => setStep('review')}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                {saving ? 'Saving…' : `Add all ${candidates.length + planCandidates.length} events →`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
