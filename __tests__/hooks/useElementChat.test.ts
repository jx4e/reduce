// __tests__/hooks/useElementChat.test.ts
import { renderHook, act } from '@testing-library/react'
import { useElementChat } from '@/hooks/useElementChat'
import type { ContentElement } from '@/types/guide'

const element: ContentElement = { id: 'el-1', type: 'paragraph', content: 'Hello' }

global.fetch = jest.fn()

describe('useElementChat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('starts with empty messages and not loading', () => {
    const { result } = renderHook(() => useElementChat('guide-1', element))
    expect(result.current.messages).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('adds user and assistant messages when send is called', async () => {
    const encoder = new TextEncoder()
    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"delta","text":"Hi"}\n\n'))
          controller.close()
        },
      }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useElementChat('guide-1', element))
    await act(async () => { result.current.send('What does this mean?') })

    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'What does this mean?' })
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant' })
  })
})
