'use client'

import GuideElement from '@/components/GuideElement'
import type { GuideSection } from '@/types/guide'

interface GuideContentProps {
  sections: GuideSection[]
  guideId: string
  contentRef: React.RefObject<HTMLDivElement>
}

export function GuideContent({ sections, guideId, contentRef }: GuideContentProps) {
  return (
    <div
      ref={contentRef}
      className="flex-1 overflow-y-auto px-6 py-6 pb-20 md:pb-6"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {sections.map(section => (
          <section key={section.id} id={`section-${section.id}`}>
            <h2 className="text-lg font-semibold mb-4">{section.heading}</h2>
            <div className="flex flex-col gap-2">
              {section.elements.map(element => (
                <GuideElement key={element.id} element={element} guideId={guideId} />
              ))}
            </div>
          </section>
        ))}
        <div className="h-[75vh]" aria-hidden="true" />
      </div>
    </div>
  )
}
