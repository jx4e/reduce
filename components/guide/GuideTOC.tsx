// components/guide/GuideTOC.tsx
'use client'

import { useState } from 'react'
import type { GuideSection } from '@/types/guide'

interface GuideTOCProps {
  sections: GuideSection[]
  activeSection: string
  onSectionClick: (id: string) => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function GuideTOC({ sections, activeSection, onSectionClick, mobileOpen, onMobileClose }: GuideTOCProps) {
  const [desktopOpen, setDesktopOpen] = useState(true)

  return (
    <>
      {/* Desktop: floating open button when closed */}
      {!desktopOpen && (
        <button
          onClick={() => setDesktopOpen(true)}
          title="Show sidebar"
          className="absolute top-3 left-3 z-10 hidden md:flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
          style={{ background: 'var(--border)', color: 'var(--foreground)' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 3.5h11M2 7.5h7M2 11.5h9" />
          </svg>
        </button>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex shrink-0 flex-col border-r overflow-hidden relative transition-all duration-300 ease-in-out"
        style={{ width: desktopOpen ? '13rem' : '0', borderColor: 'var(--border)' }}
      >
        <div className="w-52 flex flex-col gap-1 px-4 py-6 flex-1 overflow-y-auto">
          <button
            onClick={() => setDesktopOpen(false)}
            title="Hide sidebar"
            className="absolute top-3 right-3 flex items-center justify-center rounded-lg w-8 h-8 transition-colors"
            style={{ background: 'transparent', color: 'var(--muted)' }}
          >
            <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            Contents
          </p>
          {sections.map((section, i) => {
            const isActive = activeSection === section.id
            return (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                onClick={() => onSectionClick(section.id)}
                className="text-xs py-1.5 px-2 rounded transition-colors"
                style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)', fontWeight: isActive ? '600' : '400', background: isActive ? 'var(--border)' : 'transparent' }}
              >
                {i + 1}. {section.heading}
              </a>
            )
          })}
        </div>
      </aside>

      {/* Mobile TOC sheet */}
      {mobileOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onMobileClose}
          />
          <div
            className="fixed left-0 right-0 z-40 rounded-t-2xl border-t border-x flex flex-col"
            style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))', height: '75vh', background: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="rounded-full" style={{ width: '2rem', height: '3px', background: 'var(--border)' }} />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Contents</h2>
              <button
                onClick={onMobileClose}
                aria-label="Close contents"
                className="flex items-center justify-center rounded-lg w-8 h-8"
                style={{ color: 'var(--muted)' }}
              >
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>
            <div data-testid="mobile-toc-section-list" className="overflow-y-auto flex flex-col gap-1 px-4 py-4">
              {sections.map((section, i) => {
                const isActive = activeSection === section.id
                return (
                  <a
                    key={section.id}
                    href={`#section-${section.id}`}
                    onClick={() => { onSectionClick(section.id); onMobileClose() }}
                    className="text-xs py-1.5 px-2 rounded transition-colors"
                    style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)', fontWeight: isActive ? '600' : '400', background: isActive ? 'var(--border)' : 'transparent' }}
                  >
                    {i + 1}. {section.heading}
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
