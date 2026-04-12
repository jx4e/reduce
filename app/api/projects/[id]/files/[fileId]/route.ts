import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

type Context = { params: Promise<{ id: string; fileId: string }> }

export async function DELETE(_request: NextRequest, context: Context) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { fileId } = await context.params

  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { userId: true } } },
  })

  if (!file || file.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await deleteFile(file.storageKey)
  await prisma.projectFile.delete({ where: { id: fileId } })

  return NextResponse.json({ ok: true })
}
