import { renderHook, act } from '@testing-library/react'
import { useGuideChat } from '@/hooks/useGuideChat'
import type { Guide } from '@/types/guide'

const guide: Guide = {
  id: 'g1',
  title: 'Physics 101',
  mode: 'math-cs',
  createdAt: '2026-04-10',
  sections: [{ id: 's1', heading: 'Intro', elements: [] }],
}

global.fetch = jest.fn()

describe('useGuideChat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts with empty messages and not loading', () => {
    const { result } = renderHook(() => useGuideChat(guide))
    expect(result.current.messages).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.input).toBe('')
  })

  it('updates input via setInput', () => {
    const { result } = renderHook(() => useGuideChat(guide))
    act(() => { result.current.setInput('Hello') })
    expect(result.current.input).toBe('Hello')
  })
})
