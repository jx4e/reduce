import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import type { ProjectDetail } from '@/types/project'
import type { GuideCardData } from '@/types/guide'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Context) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const row = await prisma.project.findUnique({
    where: { id },
    include: {
      files: { orderBy: { uploadedAt: 'desc' } },
      guides: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, mode: true, createdAt: true },
      },
    },
  })

  if (!row || row.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const detail: ProjectDetail = {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    files: row.files.map(f => ({
      id: f.id,
      projectId: f.projectId,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })),
    guides: row.guides.map(g => ({
      id: g.id,
      title: g.title,
      mode: g.mode as GuideCardData['mode'],
      createdAt: g.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    } satisfies GuideCardData)),
  }

  return NextResponse.json(detail)
}

export async function DELETE(_request: NextRequest, context: Context) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const project = await prisma.project.findUnique({
    where: { id },
    include: { files: { select: { storageKey: true } } },
  })

  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await Promise.all(project.files.map(f => deleteFile(f.storageKey)))
  await prisma.project.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
