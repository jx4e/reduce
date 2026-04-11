// components/elements/HeadingElement.tsx
'use client'

import type { ContentElement } from '@/types/guide'

export function HeadingElement({ element }: { element: ContentElement }) {
  return element.level === 3
    ? <h3 className="text-base font-semibold mt-4 mb-1">{element.content}</h3>
    : <h2 className="text-lg font-semibold mt-6 mb-2">{element.content}</h2>
}
