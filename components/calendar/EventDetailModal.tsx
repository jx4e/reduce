// components/calendar/EventDetailModal.tsx
'use client'

import { useState } from 'react'
import type { StudyEventData, EventType } from '@/types/calendar'

interface Props {
  event: StudyEventData
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'study',      label: 'Study session' },
  { value: 'exam',       label: 'Exam'          },
  { value: 'assignment', label: 'Assignment'     },
  { value: 'other',      label: 'Other'          },
]

export default function EventDetailModal({ event, onClose, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date.split('T')[0])
  const [time, setTime] = useState(event.date.includes('T') && !event.date.endsWith('T00:00:00.000Z')
    ? event.date.split('T')[1]?.slice(0, 5) ?? ''
    : '')
  const [duration, setDuration] = useState(event.duration?.toString() ?? '')
  const [type, setType] = useState<EventType>(event.type)
  const [notes, setNotes] = useState(event.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const isoDate = time
        ? new Date(`${date}T${time}`).toISOString()
        : `${date}T00:00:00.000Z`
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          date: isoDate,
          duration: duration ? parseInt(duration, 10) : null,
          type,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) { setError('Failed to save. Please try again.'); return }
      onUpdated()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: 'DELETE' })
      if (!res.ok) { setError('Failed to delete. Please try again.'); setConfirmDelete(false); return }
      onDeleted()
    } catch {
      setError('Network error. Please try again.')
      setConfirmDelete(false)
    }
  }

  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

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
            className="text-lg font-bold truncate"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
          >
            {editing ? 'Edit event' : event.title}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        {!editing ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{formattedDate}</div>
            {event.duration && (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>{event.duration} minutes</div>
            )}
            <div>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--surface)', color: 'var(--muted)', textTransform: 'capitalize' }}
              >
                {event.type}
              </span>
            </div>
            {event.notes && <p className="text-sm" style={{ color: 'var(--foreground)' }}>{event.notes}</p>}
            {event.gcalEventId && (
              <div className="text-xs" style={{ color: '#4d7c4d' }}>✓ Synced to Google Calendar</div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="rounded-md px-3 py-2 text-sm"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={type}
                onChange={e => setType(e.target.value as EventType)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              >
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                type="number"
                min="5"
                max="480"
                placeholder="Duration (min)"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="rounded-md px-3 py-2 text-sm"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="rounded-md px-3 py-2 text-sm resize-none"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
          </div>
        )}

        {error && <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>}

        {confirmDelete ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>Delete this event? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#dc2626', color: '#fff' }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Delete
            </button>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
