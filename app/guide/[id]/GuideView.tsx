// app/guide/[id]/GuideView.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GuideTOC } from '@/components/guide/GuideTOC'
import { GuideContent } from '@/components/guide/GuideContent'
import { GuideChatPanel } from '@/components/guide/GuideChatPanel'
import { useGuideScroll } from '@/hooks/useGuideScroll'
import type { Guide } from '@/types/guide'

export default function GuideView({ guide }: { guide: Guide }) {
  const { activeSection, contentRef, scrollToSection } = useGuideScroll(guide.sections)
  const [mobileSheet, setMobileSheet] = useState<'toc' | 'chat' | null>(null)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-semibold truncate flex-1">{guide.title}</h1>
        <Link href="/" className="text-sm transition-colors shrink-0" style={{ color: 'var(--muted)' }}>
          ← Home
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <GuideTOC
          sections={guide.sections}
          activeSection={activeSection}
          onSectionClick={scrollToSection}
          mobileOpen={mobileSheet === 'toc'}
          onMobileClose={() => setMobileSheet(null)}
        />

        <GuideContent
          sections={guide.sections}
          guideId={guide.id}
          contentRef={contentRef}
        />

        <GuideChatPanel
          guide={guide}
          mobileOpen={mobileSheet === 'chat'}
          onMobileClose={() => setMobileSheet(null)}
        />
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--background)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          aria-label="Contents"
          onClick={() => setMobileSheet(s => s === 'toc' ? null : 'toc')}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity"
          style={{ color: mobileSheet === 'toc' ? 'var(--accent)' : 'var(--muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 3.5h11M2 7.5h7M2 11.5h9" />
          </svg>
          <span className="text-[10px] font-medium">Contents</span>
        </button>
        <button
          aria-label="Guide"
          onClick={() => setMobileSheet(null)}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity"
          style={{ color: mobileSheet === null ? 'var(--accent)' : 'var(--muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="1" width="11" height="13" rx="1" />
            <path d="M5 5h5M5 8h5M5 11h3" />
          </svg>
          <span className="text-[10px] font-medium">Guide</span>
        </button>
        <button
          aria-label="Chat"
          onClick={() => setMobileSheet(s => s === 'chat' ? null : 'chat')}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity"
          style={{ color: mobileSheet === 'chat' ? 'var(--accent)' : 'var(--muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2.5V3a1 1 0 0 1 1-1z" />
          </svg>
          <span className="text-[10px] font-medium">Chat</span>
        </button>
      </nav>
    </div>
  )
}
