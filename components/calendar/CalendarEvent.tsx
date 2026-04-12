// components/calendar/CalendarEvent.tsx
import type { StudyEventData, EventType } from '@/types/calendar'

const TYPE_STYLES: Record<EventType, { border: string; bg: string; text: string }> = {
  study:      { border: 'var(--accent)',  bg: 'var(--surface)', text: 'var(--accent)' },
  exam:       { border: '#dc2626',        bg: '#fef2f2',        text: '#dc2626'       },
  assignment: { border: '#d97706',        bg: '#fffbeb',        text: '#d97706'       },
  other:      { border: 'var(--muted)',   bg: 'var(--surface)', text: 'var(--muted)'  },
}

interface Props {
  event: StudyEventData
  onClick?: (e?: React.MouseEvent) => void
  /** 'chip' = compact grid chip; 'row' = dashboard widget row */
  variant?: 'chip' | 'row'
}

export default function CalendarEvent({ event, onClick, variant = 'chip' }: Props) {
  const style = TYPE_STYLES[event.type] ?? TYPE_STYLES.other

  if (variant === 'row') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 w-full text-left px-0 py-0 bg-transparent border-none cursor-pointer"
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: style.border, flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {event.title}
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {event.duration ? ` · ${event.duration} min` : ''}
          </span>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: style.bg, color: style.text }}
        >
          {event.type}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-1.5 py-0.5 rounded text-xs font-medium truncate cursor-pointer"
      style={{
        borderLeft: `2px solid ${style.border}`,
        background: style.bg,
        color: style.text,
      }}
      title={event.title}
    >
      {event.title}
    </button>
  )
}
