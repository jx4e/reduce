// components/elements/ImageElement.tsx
'use client'

import type { ContentElement } from '@/types/guide'

export function ImageElement({ element }: { element: ContentElement }) {
  if (!element.src) return null
  return (
    <figure className="my-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={element.src}
        alt={element.content}
        className="rounded-md w-full object-contain"
        style={{ maxHeight: '20rem', background: 'var(--surface)' }}
      />
      {element.content && (
        <figcaption className="mt-1.5 text-xs text-center" style={{ color: 'var(--muted)' }}>
          {element.content}
        </figcaption>
      )}
    </figure>
  )
}
