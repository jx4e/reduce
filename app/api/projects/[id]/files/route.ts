import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/storage'
import type { ProjectFile } from '@/types/project'

type Context = { params: Promise<{ id: string }> }

const ALLOWED_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'])
const MAX_FILES = 5
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest, context: Context) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await context.params

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files per upload` }, { status: 400 })
  }
  const badType = files.find(f => !ALLOWED_TYPES.has(f.type))
  if (badType) {
    return NextResponse.json({ error: `Unsupported file type: ${badType.type}` }, { status: 400 })
  }
  const oversized = files.find(f => f.size > MAX_BYTES)
  if (oversized) {
    return NextResponse.json({ error: `File "${oversized.name}" exceeds 10 MB limit` }, { status: 400 })
  }

  const saved: ProjectFile[] = []

  for (const file of files) {
    const key = `projects/${projectId}/${randomUUID()}-${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadFile(key, buffer, file.type)
    const record = await prisma.projectFile.create({
      data: { projectId, name: file.name, size: file.size, mimeType: file.type, storageKey: key },
    })
    saved.push({
      id: record.id,
      projectId: record.projectId,
      name: record.name,
      size: record.size,
      mimeType: record.mimeType,
      storageKey: record.storageKey,
      uploadedAt: record.uploadedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })
  }

  return NextResponse.json(saved, { status: 201 })
}
