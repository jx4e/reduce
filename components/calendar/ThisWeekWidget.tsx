// components/calendar/ThisWeekWidget.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CalendarEvent from './CalendarEvent'
import type { StudyEventData } from '@/types/calendar'

export default function ThisWeekWidget() {
  const [events, setEvents] = useState<StudyEventData[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const now = new Date()
    // Monday of this week
    const day = now.getDay() // 0=Sun
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    // Sunday of this week
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    fetch(`/api/calendar/events?from=${monday.toISOString()}&to=${sunday.toISOString()}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((data: StudyEventData[]) => {
        setEvents(data)
        setLoaded(true)
      })
      .catch(() => {
        setError(true)
        setLoaded(true)
      })
  }, [])

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          This Week
        </span>
        <Link href="/calendar" className="text-xs" style={{ color: 'var(--muted)' }}>
          View calendar →
        </Link>
      </div>

      {/* Events */}
      <div className="flex flex-col">
        {!loaded && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2].map(i => (
              <div
                key={i}
                className="h-8 rounded animate-pulse"
                style={{ background: 'var(--surface)' }}
              />
            ))}
          </div>
        )}

        {loaded && error && (
          <div className="px-4 py-5 text-center">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Could not load events.</p>
          </div>
        )}

        {loaded && !error && events.length === 0 && (
          <div className="px-4 py-5 text-center">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Nothing scheduled this week.</p>
            <Link href="/calendar" className="text-xs font-semibold mt-1 inline-block" style={{ color: 'var(--accent)' }}>
              Add events →
            </Link>
          </div>
        )}

        {loaded && !error && events.map((ev, i) => (
          <div
            key={ev.id}
            className="px-4 py-2.5"
            style={{ borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none' }}
          >
            <CalendarEvent event={ev} variant="row" />
          </div>
        ))}
      </div>
    </div>
  )
}
