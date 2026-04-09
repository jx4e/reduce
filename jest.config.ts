import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-markdown$': '<rootDir>/__mocks__/react-markdown.tsx',
    '^remark-math$': '<rootDir>/__mocks__/remark-math.js',
    '^rehype-katex$': '<rootDir>/__mocks__/rehype-katex.js',
    '^katex$': '<rootDir>/__mocks__/katex.js',
    '^framer-motion$': '<rootDir>/__mocks__/framer-motion.tsx',
  },
  testPathIgnorePatterns: ['/node_modules/', `${process.cwd()}/.worktrees/`],
}

export default createJestConfig(config)
