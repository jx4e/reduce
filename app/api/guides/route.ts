import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import type { GuideCardData } from '@/types/guide'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await prisma.guide.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, mode: true, createdAt: true },
  })

  const guides: GuideCardData[] = rows.map((r: typeof rows[number]) => ({
    id: r.id,
    title: r.title,
    mode: r.mode as GuideCardData['mode'],
    createdAt: r.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }))

  return NextResponse.json(guides)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.id || !body?.title || !body?.mode) {
    return NextResponse.json({ error: 'Invalid guide data' }, { status: 400 })
  }

  await prisma.guide.create({
    data: {
      id: body.id,
      userId: session.user.id,
      title: body.title,
      mode: body.mode,
      content: body.sections ?? [],
      ...(body.projectId ? { projectId: body.projectId } : {}),
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
