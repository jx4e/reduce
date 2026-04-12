// app/api/calendar/extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { extractDatesFromText } from '@/lib/calendarAI'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''
  let text: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (file) {
      // For PDF/text files, read as text
      text = await file.text()
    }
  } else {
    const body = await request.json().catch(() => null)
    text = body?.text ?? null
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text or file is required' }, { status: 400 })
  }

  const { events, inputTokens, outputTokens } = await extractDatesFromText(text)

  await prisma.tokenUsage.create({
    data: {
      userId: session.user.id,
      operation: 'calendar-extract',
      inputTokens,
      outputTokens,
    },
  })

  return NextResponse.json(events)
}
