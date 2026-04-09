import type { Guide, GuideCardData } from '@/types/guide'

const INDEX_KEY = 'guide-index'

function getIndex(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveGuide(guide: Guide): void {
  localStorage.setItem(guide.id, JSON.stringify(guide))
  const index = getIndex().filter(id => id !== guide.id)
  index.unshift(guide.id) // most recent first
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function listGuides(): GuideCardData[] {
  return getIndex().flatMap(id => {
    try {
      const raw = localStorage.getItem(id)
      if (!raw) return []
      const g = JSON.parse(raw) as Guide
      return [{ id: g.id, title: g.title, mode: g.mode, createdAt: g.createdAt }]
    } catch {
      return []
    }
  })
}
