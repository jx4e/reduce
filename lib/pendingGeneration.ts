import type { GuideMode } from '@/types/guide'

interface PendingGeneration {
  files: File[]
  mode: GuideMode
}

let pending: PendingGeneration | null = null

export function setPending(data: PendingGeneration): void {
  pending = data
}

/** Read pending data without clearing it. */
export function peekPending(): PendingGeneration | null {
  return pending
}

/** Explicitly clear pending data (call on success or user dismissal). */
export function clearPending(): void {
  pending = null
}

/** Legacy: read and immediately clear. Kept for any existing callers. */
export function consumePending(): PendingGeneration | null {
  const p = pending
  pending = null
  return p
}
