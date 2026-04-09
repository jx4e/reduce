import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import type { Guide, GuideMode, GuideSection } from '@/types/guide'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Context) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const row = await prisma.guide.findUnique({ where: { id } })

  if (!row || row.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const guide: Guide = {
    id: row.id,
    title: row.title,
    mode: row.mode as GuideMode,
    sections: row.content as GuideSection[],
    createdAt: row.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }

  return NextResponse.json(guide)
}
