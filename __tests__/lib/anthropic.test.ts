import { buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'

describe('buildSystemPrompt', () => {
  it('includes LaTeX and code instructions for math-cs mode', () => {
    const prompt = buildSystemPrompt('math-cs')
    expect(prompt).toContain('formula')
    expect(prompt).toContain('code')
    expect(prompt).toContain('LaTeX')
  })

  it('includes timeline instructions for humanities mode', () => {
    const prompt = buildSystemPrompt('humanities')
    expect(prompt).toContain('timeline')
  })

  it('instructs Claude to return raw JSON only', () => {
    const prompt = buildSystemPrompt('math-cs')
    expect(prompt).toContain('raw JSON')
  })
})

describe('fileToContentBlock', () => {
  it('converts a PDF file to a base64 document block', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]) // %PDF magic bytes
    const file = new File([bytes], 'notes.pdf', { type: 'application/pdf' })
    const block = await fileToContentBlock(file)
    expect(block.type).toBe('document')
    if (block.type === 'document') {
      expect(block.source.type).toBe('base64')
      expect(block.source.media_type).toBe('application/pdf')
      expect(typeof block.source.data).toBe('string')
    }
  })

  it('converts a text file to a text block', async () => {
    const file = new File(['# Hello\nSome notes'], 'notes.md', { type: 'text/plain' })
    const block = await fileToContentBlock(file)
    expect(block.type).toBe('text')
    if (block.type === 'text') {
      expect(block.text).toContain('Hello')
    }
  })
})
