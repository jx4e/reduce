// components/calendar/CalendarGrid.tsx
'use client'

import { useMemo } from 'react'
import CalendarEvent from './CalendarEvent'
import type { StudyEventData } from '@/types/calendar'

interface Props {
  year: number
  month: number   // 0-indexed
  events: StudyEventData[]
  onDayClick: (date: Date) => void
  onEventClick: (event: StudyEventData) => void
}

function getDaysInMonth(year: number, month: number) {
  const days: { date: Date; isCurrentMonth: boolean }[] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  // Pad start (Sunday=0)
  for (let i = 0; i < first.getDay(); i++) {
    days.push({ date: new Date(year, month, -first.getDay() + i + 1), isCurrentMonth: false })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  // Pad end to complete the last row
  while (days.length % 7 !== 0) {
    days.push({ date: new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1), isCurrentMonth: false })
  }
  return days
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarGrid({ year, month, events, onDayClick, onEventClick }: Props) {
  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const today = new Date()

  function eventsForDay(date: Date) {
    return events.filter(e => {
      const d = new Date(e.date)
      return d.getFullYear() === date.getFullYear()
        && d.getMonth() === date.getMonth()
        && d.getDate() === date.getDate()
    })
  }

  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Day headers */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {DAY_LABELS.map(d => (
          <div
            key={d}
            className="py-2 text-center"
            style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map(({ date, isCurrentMonth }, i) => {
          const dayEvents = eventsForDay(date)
          const today_ = isToday(date)
          return (
            <div
              key={i}
              onClick={() => onDayClick(date)}
              className="flex flex-col gap-1 cursor-pointer"
              style={{
                padding: '6px 8px',
                minHeight: 80,
                borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                borderBottom: i < days.length - 7 ? '1px solid var(--border)' : 'none',
                background: 'var(--background)',
                opacity: isCurrentMonth ? 1 : 0.4,
                outline: today_ ? '2px solid var(--accent)' : 'none',
                outlineOffset: -2,
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 22, height: 22,
                  borderRadius: '50%',
                  fontSize: 11,
                  fontWeight: 600,
                  color: today_ ? '#fff' : 'var(--foreground)',
                  background: today_ ? 'var(--accent)' : 'transparent',
                }}
              >
                {date.getDate()}
              </span>
              {dayEvents.slice(0, 3).map(ev => (
                <CalendarEvent
                  key={ev.id}
                  event={ev}
                  onClick={e => { e?.stopPropagation(); onEventClick(ev) }}
                />
              ))}
              {dayEvents.length > 3 && (
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>+{dayEvents.length - 3} more</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
