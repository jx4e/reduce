'use client'

import { useRef, useState } from 'react'

interface UploadZoneProps {
  onFilesChange: (files: File[]) => void
}

export default function UploadZone({ onFilesChange }: UploadZoneProps) {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    const arr = Array.from(incoming)
    setFiles(arr)
    onFilesChange(arr)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => { setDragging(false) }}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors"
      style={{
        borderColor: dragging ? 'var(--accent)' : 'var(--border)',
        background: dragging ? 'rgba(99,102,241,0.05)' : 'var(--surface)',
      }}
    >
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept=".pdf,.ppt,.pptx,.doc,.docx,.txt"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <span className="text-2xl">⬆</span>
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        Drag & drop or click
      </p>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        PDF, slides, notes — multiple files supported
      </p>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-left w-full">
          {files.map(f => (
            <li key={f.name} className="text-xs truncate" style={{ color: 'var(--accent)' }}>
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
