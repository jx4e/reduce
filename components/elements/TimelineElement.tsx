// components/elements/TimelineElement.tsx
'use client'

import type { ContentElement } from '@/types/guide'

export function TimelineElement({ element }: { element: ContentElement }) {
  const events = element.events ?? []
  return (
    <div className="my-3 flex flex-col" style={{ paddingLeft: '1rem' }}>
      {events.map((event, i) => (
        <div key={i} className="relative flex gap-4" style={{ paddingBottom: i < events.length - 1 ? '1.5rem' : 0 }}>
          <div className="flex flex-col items-center shrink-0" style={{ width: '1rem' }}>
            <div className="rounded-full shrink-0" style={{ width: '0.5rem', height: '0.5rem', marginTop: '0.35rem', background: 'var(--accent)' }} />
            {i < events.length - 1 && (
              <div className="flex-1 mt-1" style={{ width: '1px', background: 'var(--border)' }} />
            )}
          </div>
          <div className="flex flex-col gap-0.5 pb-0.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{event.date}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{event.title}</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{event.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
