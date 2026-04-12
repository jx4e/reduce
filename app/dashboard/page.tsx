'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import GuideCard from '@/components/GuideCard'
import UploadZone from '@/components/UploadZone'
import type { GuideCardData, GuideMode } from '@/types/guide'
import type { ProjectCardData } from '@/types/project'
import { setPending } from '@/lib/pendingGeneration'

interface UsageData {
  totalTokens: number
  estimatedCostUsd: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [guides, setGuides] = useState<GuideCardData[]>([])
  const [groups, setGroups] = useState<ProjectCardData[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')

  useEffect(() => {
    Promise.all([
      fetch('/api/guides').then(r => r.json()).catch(() => []),
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/usage').then(r => r.json()).catch(() => null),
    ]).then(([g, p, u]) => {
      setGuides(g)
      setGroups(p)
      setUsage(u)
      setLoaded(true)
    })
  }, [])

  function handleGenerate() {
    if (files.length === 0) return
    setPending({ files, mode })
    router.push('/generate')
  }

  const recentGuides = guides.slice(0, 4)
  const recentGroups = groups.slice(0, 3)

  const totalTokens = usage?.totalTokens ?? null
  const estimatedCostUsd = usage?.estimatedCostUsd ?? null

  function formatTokens(n: number | null): string {
    if (n === null) return '—'
    return n.toLocaleString('en-US')
  }

  function formatCost(n: number | null): string {
    if (n === null) return '—'
    return `$${n.toFixed(4)}`
  }

  type StatCard =
    | { label: string; value: string; href: string; linked: true }
    | { label: string; value: string; linked: false }

  const stats: StatCard[] = [
    { label: 'Guides', value: loaded ? String(guides.length) : '—', href: '/guides', linked: true },
    { label: 'Groups', value: loaded ? String(groups.length) : '—', href: '/groups', linked: true },
    { label: 'Tokens', value: loaded ? formatTokens(totalTokens) : '—', linked: false },
    { label: 'Est. Cost', value: loaded ? formatCost(estimatedCostUsd) : '—', linked: false },
  ]

  return (
    <div className="flex flex-1 flex-col px-6 py-10 max-w-5xl mx-auto w-full">

      {/* Header */}
      <div className="mb-10">
        <h1
          className="text-3xl font-bold tracking-tight mb-1"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
        >
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your study activity at a glance.
        </p>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-4 gap-px mb-10 rounded-lg overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        {stats.map(stat => {
          const inner = (
            <div className="flex flex-col gap-1">
              <span
                className="text-3xl font-bold tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
              >
                {stat.value}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                {stat.label}
              </span>
            </div>
          )

          if (stat.linked) {
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group flex items-center justify-between px-6 py-5 transition-colors"
                style={{ background: 'var(--background)' }}
              >
                {inner}
                <span
                  className="text-sm transition-transform group-hover:translate-x-0.5"
                  style={{ color: 'var(--muted-dark)' }}
                >
                  →
                </span>
              </Link>
            )
          }

          return (
            <div
              key={stat.label}
              className="flex items-center px-6 py-5"
              style={{ background: 'var(--background)' }}
            >
              {inner}
            </div>
          )
        })}
      </div>

      {/* Main grid: generate + recent */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">

        {/* Left: recent guides */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Recent Guides
            </h2>
            <Link href="/guides" className="text-xs" style={{ color: 'var(--muted)' }}>
              View all →
            </Link>
          </div>

          {!loaded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="h-20 rounded-lg"
                  style={{ background: 'var(--surface)', animation: 'loading-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}

          {loaded && recentGuides.length === 0 && (
            <div
              className="flex flex-col items-center justify-center rounded-lg border py-12 text-center gap-3"
              style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
            >
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No guides yet.</p>
              <Link
                href="/guides"
                className="text-xs font-semibold px-4 py-1.5 rounded-full"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Create your first guide →
              </Link>
            </div>
          )}

          {loaded && recentGuides.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentGuides.map(guide => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          )}
        </div>

        {/* Right: quick generate + recent groups */}
        <div className="flex flex-col gap-8">

          {/* Quick generate */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              Quick Generate
            </h2>
            <div
              className="flex flex-col gap-4 rounded-lg border p-5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <UploadZone onFilesChange={setFiles} compact />
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Mode:</span>
                <div
                  className="flex rounded border overflow-hidden text-xs"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {(['math-cs', 'humanities'] as GuideMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="px-3 py-1 font-medium transition-colors"
                      style={{
                        background: mode === m ? 'var(--accent)' : 'var(--background)',
                        color: mode === m ? '#fff' : 'var(--muted)',
                      }}
                    >
                      {m === 'math-cs' ? 'Math / CS' : 'Humanities'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={files.length === 0}
                className="w-full rounded py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Generate Guide →
              </button>
            </div>
          </div>

          {/* Recent groups */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Groups
              </h2>
              <Link href="/groups" className="text-xs" style={{ color: 'var(--muted)' }}>
                View all →
              </Link>
            </div>

            {loaded && recentGroups.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>No groups yet.</p>
            )}

            {loaded && recentGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                {recentGroups.map(g => (
                  <Link
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className="flex flex-col gap-1 rounded-lg border px-4 py-3 transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                  >
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {g.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {g.fileCount} {g.fileCount === 1 ? 'file' : 'files'} · {g.guideCount} {g.guideCount === 1 ? 'guide' : 'guides'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
