'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectCardData } from '@/types/project'

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<ProjectCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => { setGroups(data); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const group: ProjectCardData = await res.json()
        router.push(`/groups/${group.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-10">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <button
            onClick={() => setShowForm(v => !v)}
            className="rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            New Group
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Group name"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        )}

        {!loading && groups.length === 0 && (
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
            No groups yet — create one to save files and generate multiple guides on the same topic.
          </p>
        )}

        {!loading && groups.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map(g => (
              <a
                key={g.id}
                href={`/groups/${g.id}`}
                className="flex flex-col gap-2 rounded-lg border p-4 transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{g.name}</span>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>{g.fileCount} {g.fileCount === 1 ? 'file' : 'files'}</span>
                  <span>·</span>
                  <span>{g.guideCount} {g.guideCount === 1 ? 'guide' : 'guides'}</span>
                  <span>·</span>
                  <span>{g.createdAt}</span>
                </div>
              </a>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
