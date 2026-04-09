import React from 'react'

const motion = new Proxy({} as Record<string, React.FC>, {
  get: (_, tag: string) =>
    // eslint-disable-next-line react/display-name
    ({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
      const props = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'whileInView', 'viewport', 'transition', 'exit'].includes(k))
      )
      return React.createElement(tag, props, children)
    },
})

export { motion }
export const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const useScroll = () => ({ scrollY: { get: () => 0 } })
export const useTransform = (_: unknown, __: unknown, output: unknown[]) => output[0]
export const useInView = () => [null, true]
export const useAnimation = () => ({ start: () => {}, set: () => {} })
