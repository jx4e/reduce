'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface AdvancedValues {
  description: string
  customTitle: string
}

interface Props {
  onChange: (values: AdvancedValues) => void
}

export default function GenerateAdvancedOptions({ onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function handleSave() {
    onChange({ description, customTitle })
    setOpen(false)
  }

  const hasValues = description.trim() || customTitle.trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-xs transition-opacity hover:opacity-70"
        style={{ color: hasValues ? 'var(--foreground)' : 'var(--muted)' }}
      >
        {hasValues ? '✦ Advanced options set' : 'Advanced options'}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', animation: 'fade-in 0.1s ease-out' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="w-full max-w-md flex flex-col gap-5 rounded-lg p-6"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              animation: 'modal-in 0.15s ease-out',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Advanced options
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-lg leading-none transition-opacity hover:opacity-50"
                style={{ color: 'var(--muted)' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                Guide title
              </label>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Overrides the AI-generated title.
              </p>
              <input
                ref={titleRef}
                type="text"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="e.g. Week 4 — Dynamic Programming"
                className="mt-1 rounded border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                Additional context
              </label>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Sent to the AI to guide how the guide is written.
              </p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Focus on the proof of correctness for Dijkstra's algorithm and include worked examples."
                rows={4}
                className="mt-1 rounded border px-3 py-2 text-sm outline-none resize-none"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="text-sm transition-opacity hover:opacity-70"
                style={{ color: 'var(--muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded px-4 py-1.5 text-sm font-semibold"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
