// components/calendar/AddEventModal.tsx
'use client'

import { useState } from 'react'
import type { EventType } from '@/types/calendar'

interface Props {
  defaultDate?: Date
  onClose: () => void
  onCreated: () => void
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'study',      label: 'Study session' },
  { value: 'exam',       label: 'Exam'          },
  { value: 'assignment', label: 'Assignment'     },
  { value: 'other',      label: 'Other'          },
]

function toInputDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function AddEventModal({ defaultDate, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate ? toInputDate(defaultDate) : toInputDate(new Date()))
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  const [type, setType] = useState<EventType>('study')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const isoDate = time
      ? new Date(`${date}T${time}`).toISOString()
      : `${date}T00:00:00.000Z`

    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        date: isoDate,
        duration: duration ? parseInt(duration, 10) : null,
        type,
        notes: notes.trim() || null,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? `Failed to create event (${res.status}). Please try again.`)
      setSaving(false)
      return
    }
    onCreated()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
          >
            Add event
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Exam 1, Study session"
              className="rounded-md px-3 py-2 text-sm w-full"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Time (optional)</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as EventType)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Duration (min)</label>
              <input
                type="number"
                min="5"
                max="480"
                placeholder="e.g. 45"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="rounded-md px-3 py-2 text-sm resize-none"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>

          {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {saving ? 'Saving…' : 'Add event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
