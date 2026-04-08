import Link from 'next/link'
import type { GuideCardData, GuideMode } from '@/types/guide'

export default function GuideCard({ guide }: { guide: GuideCardData }) {
  const modeLabels: Record<GuideMode, string> = {
    'math-cs': 'Math / CS',
    'humanities': 'Humanities',
  }
  const modeLabel = modeLabels[guide.mode]

  return (
    <Link
      href={`/guide/${guide.id}`}
      className="guide-card flex flex-col gap-3 rounded-lg border p-4 transition-colors"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
      }}
    >
      <span className="text-sm font-medium leading-snug line-clamp-2"
            style={{ color: 'var(--foreground)' }}>
        {guide.title}
      </span>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {guide.createdAt}
        </span>
        <span className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'var(--border)', color: 'var(--muted)' }}>
          {modeLabel}
        </span>
      </div>
    </Link>
  )
}
