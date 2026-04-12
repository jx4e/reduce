// app/calendar/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import CalendarGrid from '@/components/calendar/CalendarGrid'
import AddEventModal from '@/components/calendar/AddEventModal'
import EventDetailModal from '@/components/calendar/EventDetailModal'
import ImportSyllabusModal from '@/components/calendar/ImportSyllabusModal'
import type { StudyEventData } from '@/types/calendar'

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const gcalParam = searchParams.get('gcal')
  const router = useRouter()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<StudyEventData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasGcalScope, setHasGcalScope] = useState<boolean | null>(null)

  // Modal state
  const [addModal, setAddModal] = useState<{ open: boolean; date?: Date }>({ open: false })
  const [detailModal, setDetailModal] = useState<{ open: boolean; event?: StudyEventData }>({ open: false })
  const [importModal, setImportModal] = useState(false)

  const fetchEvents = useCallback(async () => {
    setError('')
    setLoading(true)
    const from = new Date(year, month, 1).toISOString()
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const res = await fetch(`/api/calendar/events?from=${from}&to=${to}`)
    if (res.ok) setEvents(await res.json())
    else setError('Failed to load events.')
    setLoading(false)
  }, [year, month])

  const fetchGcalStatus = useCallback(async () => {
    const r = await fetch('/api/calendar/gcal/status')
    if (r.ok) {
      const { hasCalendarScope } = await r.json()
      setHasGcalScope(hasCalendarScope)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useEffect(() => { fetchGcalStatus() }, [fetchGcalStatus])
  useEffect(() => {
    if (gcalParam) {
      router.replace('/calendar')
    }
  }, [gcalParam, router])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']

  return (
    <div className="flex flex-1 flex-col px-6 py-10 max-w-5xl mx-auto w-full gap-6">

      {/* GCal connect banner */}
      {hasGcalScope === false && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--muted)' }}>
            Connect Google Calendar to sync your events automatically.
          </span>
          <a
            href="/api/calendar/gcal/connect"
            className="text-sm font-semibold px-4 py-1.5 rounded"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Connect →
          </a>
        </div>
      )}

      {/* GCal success/error flash */}
      {gcalParam === 'connected' && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#f0f7f0', border: '1px solid #c4dcc4', color: '#4d7c4d' }}>
          Google Calendar connected successfully.
        </div>
      )}
      {gcalParam === 'error' && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
          Could not connect Google Calendar. Please try again.
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            Study Calendar
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Your study sessions, exams &amp; deadlines
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {hasGcalScope && (
            <span
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#f0f7f0', border: '1px solid #c4dcc4', color: '#4d7c4d' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4d7c4d', display: 'inline-block' }} />
              Syncing to Google Calendar
            </span>
          )}
          <button
            onClick={() => setImportModal(true)}
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
          >
            ↑ Import syllabus
          </button>
          <button
            onClick={() => setAddModal({ open: true })}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            + Add event
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ width: 28, height: 28, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14 }}
        >
          ‹
        </button>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)', minWidth: 130 }}
        >
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ width: 28, height: 28, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 14 }}
        >
          ›
        </button>
      </div>

      {/* Grid */}
      {loading
        ? <div className="rounded-lg h-96 animate-pulse" style={{ background: 'var(--surface)' }} />
        : (
          <CalendarGrid
            year={year}
            month={month}
            events={events}
            onDayClick={date => setAddModal({ open: true, date })}
            onEventClick={event => setDetailModal({ open: true, event })}
          />
        )
      }
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5" style={{ fontSize: 11, color: 'var(--muted)' }}>
        {[
          { label: 'Study session', color: 'var(--accent)' },
          { label: 'Exam',          color: '#dc2626' },
          { label: 'Assignment',    color: '#d97706' },
          { label: 'Other',         color: 'var(--muted)' },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 1, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* Modals */}
      {addModal.open && (
        <AddEventModal
          defaultDate={addModal.date}
          onClose={() => setAddModal({ open: false })}
          onCreated={() => { setAddModal({ open: false }); fetchEvents() }}
        />
      )}
      {detailModal.open && detailModal.event && (
        <EventDetailModal
          event={detailModal.event}
          onClose={() => setDetailModal({ open: false })}
          onUpdated={() => { setDetailModal({ open: false }); fetchEvents() }}
          onDeleted={() => { setDetailModal({ open: false }); fetchEvents() }}
        />
      )}
      {importModal && (
        <ImportSyllabusModal
          onClose={() => setImportModal(false)}
          onImported={() => { setImportModal(false); fetchEvents() }}
        />
      )}
    </div>
  )
}
