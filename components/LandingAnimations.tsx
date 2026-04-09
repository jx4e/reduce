'use client'

import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'

interface AnimProps {
  children: ReactNode
  delay?: number
  className?: string
  style?: CSSProperties
}

const ease = [0.25, 0.46, 0.45, 0.94] as const

/** Fades up on page load — use for hero elements with staggered delays. */
export function HeroItem({ children, delay = 0, className, style }: AnimProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

/** Fades up when scrolled into view — use for below-fold sections. */
export function FadeUp({ children, delay = 0, className, style }: AnimProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}
