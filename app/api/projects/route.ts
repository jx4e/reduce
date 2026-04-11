import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import type { ProjectCardData } from '@/types/project'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { files: true, guides: true } } },
  })

  const projects: ProjectCardData[] = rows.map(r => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    fileCount: r._count.files,
    guideCount: r._count.guides,
  }))

  return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const project = await prisma.project.create({
    data: { userId: session.user.id, name: body.name.trim() },
  })

  return NextResponse.json(
    {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      fileCount: 0,
      guideCount: 0,
    },
    { status: 201 },
  )
}
