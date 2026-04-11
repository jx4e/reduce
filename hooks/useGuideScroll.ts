'use client'

import { useEffect, useRef, useState } from 'react'
import type { GuideSection } from '@/types/guide'

export interface UseGuideScrollReturn {
  activeSection: string
  contentRef: React.RefObject<HTMLDivElement | null>
  scrollToSection: (id: string) => void
}

export function useGuideScroll(sections: GuideSection[]): UseGuideScrollReturn {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? '')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#section-')) {
      const sectionId = hash.slice('#section-'.length)
      if (sections.some(s => s.id === sectionId)) {
        setActiveSection(sectionId)
        document.getElementById(`section-${sectionId}`)?.scrollIntoView()
      }
    }
  }, [])

  useEffect(() => {
    const scrollEl = contentRef.current
    if (!scrollEl) return

    function updateActive() {
      const { scrollTop, clientHeight, scrollHeight } = scrollEl!
      if (scrollTop + clientHeight >= scrollHeight - 4) {
        setActiveSection(sections[sections.length - 1]?.id ?? '')
        return
      }
      const threshold = clientHeight * 0.25
      let active = sections[0]?.id ?? ''
      for (const section of sections) {
        const el = scrollEl!.querySelector(`#section-${section.id}`) as HTMLElement | null
        if (el && el.offsetTop - scrollTop <= threshold) active = section.id
      }
      setActiveSection(active)
    }

    scrollEl.addEventListener('scroll', updateActive, { passive: true })
    return () => scrollEl.removeEventListener('scroll', updateActive)
  }, [sections])

  function scrollToSection(id: string) {
    setActiveSection(id)
    document.getElementById(`section-${id}`)?.scrollIntoView()
  }

  return { activeSection, contentRef, scrollToSection }
}
