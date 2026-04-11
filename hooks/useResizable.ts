'use client'

import { useRef, useState } from 'react'

const MIN_WIDTH = 220
const MAX_WIDTH = 560

export interface UseResizableReturn {
  width: number
  isDragging: boolean
  handlePointerDown: (e: React.PointerEvent) => void
  handlePointerMove: (e: React.PointerEvent) => void
  handlePointerUp: () => void
}

export function useResizable(initialWidth = 300): UseResizableReturn {
  const [width, setWidth] = useState(initialWidth)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    dragRef.current = { startX: e.clientX, startW: width }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const delta = dragRef.current.startX - e.clientX
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startW + delta)))
  }

  function handlePointerUp() {
    dragRef.current = null
    setIsDragging(false)
  }

  return { width, isDragging, handlePointerDown, handlePointerMove, handlePointerUp }
}
