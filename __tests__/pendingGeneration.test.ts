import { setPending, peekPending, clearPending, consumePending } from '@/lib/pendingGeneration'

describe('pendingGeneration', () => {
  afterEach(() => {
    clearPending()
  })

  it('peekPending returns data without clearing it', () => {
    const data = { files: [] as File[], mode: 'math-cs' as const }
    setPending(data)
    expect(peekPending()).toEqual(data)
    expect(peekPending()).toEqual(data) // still present after second peek
  })

  it('clearPending removes the pending data', () => {
    setPending({ files: [] as File[], mode: 'math-cs' })
    clearPending()
    expect(peekPending()).toBeNull()
  })

  it('peekPending returns null when nothing is set', () => {
    expect(peekPending()).toBeNull()
  })

  it('consumePending still reads and clears (existing behaviour unchanged)', () => {
    const data = { files: [] as File[], mode: 'humanities' as const }
    setPending(data)
    expect(consumePending()).toEqual(data)
    expect(peekPending()).toBeNull()
  })

  it('preserves projectId and storedFileIds through set and peek', () => {
    setPending({ files: [], mode: 'math-cs', projectId: 'p1', storedFileIds: ['f1', 'f2'] })
    const result = peekPending()
    expect(result?.projectId).toBe('p1')
    expect(result?.storedFileIds).toEqual(['f1', 'f2'])
  })
})
