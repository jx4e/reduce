import type { GuideMode } from '@/types/guide'

interface PendingGeneration {
  files: File[]
  mode: GuideMode
}

let pending: PendingGeneration | null = null

export function setPending(data: PendingGeneration): void {
  pending = data
}

export function consumePending(): PendingGeneration | null {
  const p = pending
  pending = null
  return p
}
