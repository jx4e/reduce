// app/api/calendar/extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { fileToContentBlock } from '@/lib/anthropic'
import { extractDatesFromText } from '@/lib/calendarAI'
import type { ContentBlock } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  let input: string | ContentBlock | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (file) {
      try {
        // Use fileToContentBlock so PDFs are sent as base64 document blocks
        // and text files are read as plain text blocks
        input = await fileToContentBlock(file)
      } catch {
        return NextResponse.json({ error: 'Could not read file' }, { status: 400 })
      }
    }
  } else {
    const body = await request.json().catch(() => null)
    input = body?.text?.trim() ? (body.text as string) : null
  }

  if (!input) {
    return NextResponse.json({ error: 'text or file is required' }, { status: 400 })
  }

  try {
    const { events, inputTokens, outputTokens } = await extractDatesFromText(input)

    await prisma.tokenUsage.create({
      data: {
        userId: session.user.id,
        operation: 'calendar-extract',
        inputTokens,
        outputTokens,
      },
    })

    return NextResponse.json(events)
  } catch (err) {
    console.error('[calendar/extract]', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
