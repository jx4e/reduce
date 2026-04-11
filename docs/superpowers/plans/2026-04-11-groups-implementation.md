# Groups Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "Groups" feature where users can organise saved source files and multiple guides under a named project, while the existing solo guide flow remains completely unchanged.

**Architecture:** A `Project` model groups `ProjectFile` records (stored on Tigris via `@aws-sdk/client-s3`) and `Guide` records (via an optional FK). The Groups tab in the navbar leads to `/groups` (list) and `/groups/[id]` (detail with file management + guide generation). The solo `/app` → `/generate` flow is untouched except for passing an optional `projectId` when saving a guide from within a group.

**Tech Stack:** Next.js App Router, Prisma (Postgres), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (Tigris), React, Tailwind CSS, Jest + Testing Library.

---

## File Map

**New files:**
- `lib/storage.ts` — Tigris S3 client wrapper
- `types/project.ts` — ProjectFile, ProjectDetail, ProjectCardData types
- `app/api/projects/route.ts` — GET list, POST create
- `app/api/projects/[id]/route.ts` — GET detail, DELETE
- `app/api/projects/[id]/files/route.ts` — POST upload files
- `app/api/projects/[id]/files/[fileId]/route.ts` — DELETE file
- `app/groups/page.tsx` — groups list page (client component)
- `app/groups/[id]/page.tsx` — server wrapper
- `app/groups/[id]/GroupPageClient.tsx` — interactive group detail
- `__tests__/lib/storage.test.ts`
- `__tests__/api/projects.test.ts`
- `__tests__/api/projects-id.test.ts`
- `__tests__/api/projects-files.test.ts`
- `__tests__/api/projects-files-id.test.ts`
- `__tests__/GroupsPage.test.tsx`
- `__tests__/GroupPageClient.test.tsx`

**Modified files:**
- `prisma/schema.prisma` — add Project, ProjectFile, projectId on Guide
- `lib/pendingGeneration.ts` — add `projectId?: string`, `storedFileIds?: string[]`
- `app/api/guides/route.ts` — accept optional `projectId` in POST
- `app/api/guides/generate/route.ts` — handle stored files + save new files to project
- `app/generate/page.tsx` — pass `projectId` in save call
- `components/Navbar.tsx` — add Groups link
- `__tests__/Navbar.test.tsx` — add Groups link assertion
- `__tests__/pendingGeneration.test.ts` — add projectId/storedFileIds tests
- `__tests__/api/guides.test.ts` — add projectId test

---

## Task 1: Install AWS SDK packages

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install dependencies**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected output: packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify installation**

```bash
node -e "require('@aws-sdk/client-s3'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install AWS SDK for Tigris storage"
```

---

## Task 2: Prisma schema — add Project and ProjectFile models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update schema**

Replace the contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  accounts      Account[]
  sessions      Session[]
  guides        Guide[]
  projects      Project[]
  createdAt     DateTime  @default(now())
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}

model Project {
  id        String        @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime      @default(now())
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  files     ProjectFile[]
  guides    Guide[]
}

model ProjectFile {
  id         String   @id @default(cuid())
  projectId  String
  name       String
  size       Int
  mimeType   String
  storageKey String
  uploadedAt DateTime @default(now())
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Guide {
  id        String   @id
  userId    String
  title     String
  mode      String
  content   Json
  projectId String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 2: Create and apply migration**

```bash
npx prisma migrate dev --name add-projects
```

Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client has new models**

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.project, typeof p.projectFile)"
```

Expected: `function function`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Project and ProjectFile models to schema"
```

---

## Task 3: Project and file types

**Files:**
- Create: `types/project.ts`

- [ ] **Step 1: Create types file**

Create `types/project.ts`:

```ts
import type { GuideCardData } from './guide'

export interface ProjectFile {
  id: string
  projectId: string
  name: string
  size: number
  mimeType: string
  storageKey: string
  uploadedAt: string
}

export interface ProjectCardData {
  id: string
  name: string
  createdAt: string
  fileCount: number
  guideCount: number
}

export interface ProjectDetail {
  id: string
  name: string
  createdAt: string
  files: ProjectFile[]
  guides: GuideCardData[]
}
```

- [ ] **Step 2: Commit**

```bash
git add types/project.ts
git commit -m "feat: add Project and ProjectFile TypeScript types"
```

---

## Task 4: Storage library

**Files:**
- Create: `lib/storage.ts`
- Create: `__tests__/lib/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/storage.test.ts`:

```ts
/**
 * @jest-environment node
 */

const mockSend = jest.fn()
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn(input => ({ _type: 'put', ...input })),
  DeleteObjectCommand: jest.fn(input => ({ _type: 'delete', ...input })),
  GetObjectCommand: jest.fn(input => ({ _type: 'get', ...input })),
}))

const mockGetSignedUrl = jest.fn()
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}))

import { uploadFile, deleteFile, getPresignedDownloadUrl } from '@/lib/storage'

beforeEach(() => jest.clearAllMocks())

describe('uploadFile', () => {
  it('calls PutObjectCommand with correct params', async () => {
    mockSend.mockResolvedValue({})
    const buf = Buffer.from('hello')
    await uploadFile('projects/p1/file.pdf', buf, 'application/pdf')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.Key).toBe('projects/p1/file.pdf')
    expect(cmd.Body).toBe(buf)
    expect(cmd.ContentType).toBe('application/pdf')
  })
})

describe('deleteFile', () => {
  it('calls DeleteObjectCommand with correct key', async () => {
    mockSend.mockResolvedValue({})
    await deleteFile('projects/p1/file.pdf')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.Key).toBe('projects/p1/file.pdf')
  })
})

describe('getPresignedDownloadUrl', () => {
  it('calls getSignedUrl and returns the URL', async () => {
    mockGetSignedUrl.mockResolvedValue('https://example.com/signed')
    const url = await getPresignedDownloadUrl('projects/p1/file.pdf')
    expect(url).toBe('https://example.com/signed')
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/lib/storage.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/storage'`

- [ ] **Step 3: Create lib/storage.ts**

Create `lib/storage.ts`:

```ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.STORAGE_ENDPOINT ?? 'https://t3.storage.dev',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
    },
  })
}

const getBucket = () => process.env.STORAGE_BUCKET_NAME ?? ''

export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  const client = getClient()
  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))
}

export async function deleteFile(key: string): Promise<void> {
  const client = getClient()
  await client.send(new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }))
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient()
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key })
  return getSignedUrl(client, command, { expiresIn })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/lib/storage.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts __tests__/lib/storage.test.ts
git commit -m "feat: add Tigris storage library"
```

---

## Task 5: Projects API — list and create

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `__tests__/api/projects.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/projects.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/projects/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function makeRequest(method: string, body?: object) {
  return new NextRequest('http://localhost/api/projects', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns projects scoped to current user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-11T00:00:00Z')
    ;(prisma.project.findMany as jest.Mock).mockResolvedValue([
      { id: 'p1', name: 'Bio Notes', createdAt: mockDate, _count: { files: 2, guides: 3 } },
    ])

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(json[0].id).toBe('p1')
    expect(json[0].name).toBe('Bio Notes')
    expect(json[0].fileCount).toBe(2)
    expect(json[0].guideCount).toBe(3)
  })
})

describe('POST /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { name: 'Bio' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
  })

  it('creates project and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-11T00:00:00Z')
    ;(prisma.project.create as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Bio', createdAt: mockDate })

    const res = await POST(makeRequest('POST', { name: 'Bio' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('p1')
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Bio' },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/api/projects.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/projects/route'`

- [ ] **Step 3: Create the route**

Create `app/api/projects/route.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/api/projects.test.ts
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/route.ts __tests__/api/projects.test.ts
git commit -m "feat: add GET and POST /api/projects"
```

---

## Task 6: Projects API — get detail and delete

**Files:**
- Create: `app/api/projects/[id]/route.ts`
- Create: `__tests__/api/projects-id.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/projects-id.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { GET, DELETE } from '@/app/api/projects/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}))
jest.mock('@/lib/storage', () => ({
  deleteFile: jest.fn(),
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(method: string, id: string) {
  return new NextRequest(`http://localhost/api/projects/${id}`, { method })
}

beforeEach(() => jest.clearAllMocks())

const mockDate = new Date('2026-04-11T00:00:00Z')
const mockProject = {
  id: 'p1',
  userId: 'user-1',
  name: 'Bio Notes',
  createdAt: mockDate,
  files: [{ id: 'f1', projectId: 'p1', name: 'notes.pdf', size: 1000, mimeType: 'application/pdf', storageKey: 'projects/p1/uuid-notes.pdf', uploadedAt: mockDate }],
  guides: [{ id: 'g1', title: 'Guide 1', mode: 'math-cs', createdAt: mockDate }],
}

describe('GET /api/projects/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('GET', 'p1'), makeContext('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('GET', 'missing'), makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when project belongs to another user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-2' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject)
    const res = await GET(makeRequest('GET', 'p1'), makeContext('p1'))
    expect(res.status).toBe(404)
  })

  it('returns project with files and guides', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject)
    const res = await GET(makeRequest('GET', 'p1'), makeContext('p1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.id).toBe('p1')
    expect(json.files).toHaveLength(1)
    expect(json.guides).toHaveLength(1)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', 'p1'), makeContext('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', 'missing'), makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('deletes files from storage then deletes project', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject)
    ;(deleteFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.project.delete as jest.Mock).mockResolvedValue({})

    const res = await DELETE(makeRequest('DELETE', 'p1'), makeContext('p1'))

    expect(res.status).toBe(200)
    expect(deleteFile).toHaveBeenCalledWith('projects/p1/uuid-notes.pdf')
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/api/projects-id.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/projects/[id]/route'`

- [ ] **Step 3: Create the route**

Create `app/api/projects/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import type { ProjectDetail, ProjectFile } from '@/types/project'
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
      storageKey: f.storageKey,
      uploadedAt: f.uploadedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    } satisfies ProjectFile)),
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/api/projects-id.test.ts
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[id]/route.ts __tests__/api/projects-id.test.ts
git commit -m "feat: add GET and DELETE /api/projects/[id]"
```

---

## Task 7: Project files API — upload

**Files:**
- Create: `app/api/projects/[id]/files/route.ts`
- Create: `__tests__/api/projects-files.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/projects-files.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/projects/[id]/files/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    projectFile: { create: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  uploadFile: jest.fn(),
}))
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid'),
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/storage'

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeFormDataRequest(id: string, files: { name: string; type: string; content: string }[]) {
  const formData = new FormData()
  files.forEach(f => {
    formData.append('files', new File([f.content], f.name, { type: f.type }))
  })
  return new NextRequest(`http://localhost/api/projects/${id}/files`, {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/projects/[id]/files', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeFormDataRequest('p1', []), makeContext('p1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when project not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeFormDataRequest('p1', [{ name: 'a.txt', type: 'text/plain', content: 'hi' }]), makeContext('p1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when no files are provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1' })
    const res = await POST(makeFormDataRequest('p1', []), makeContext('p1'))
    expect(res.status).toBe(400)
  })

  it('uploads file to storage and creates DB record', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.project.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1' })
    ;(uploadFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.projectFile.create as jest.Mock).mockResolvedValue({
      id: 'pf1', projectId: 'p1', name: 'notes.txt', size: 2, mimeType: 'text/plain',
      storageKey: 'projects/p1/test-uuid-notes.txt', uploadedAt: new Date(),
    })

    const res = await POST(
      makeFormDataRequest('p1', [{ name: 'notes.txt', type: 'text/plain', content: 'hi' }]),
      makeContext('p1'),
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(uploadFile).toHaveBeenCalledWith(
      'projects/p1/test-uuid-notes.txt',
      expect.any(Buffer),
      'text/plain',
    )
    expect(prisma.projectFile.create).toHaveBeenCalledWith({
      data: {
        projectId: 'p1',
        name: 'notes.txt',
        size: 2,
        mimeType: 'text/plain',
        storageKey: 'projects/p1/test-uuid-notes.txt',
      },
    })
    expect(json).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/api/projects-files.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/projects/[id]/files/route'`

- [ ] **Step 3: Create the route**

Create `app/api/projects/[id]/files/route.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/api/projects-files.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[id]/files/route.ts __tests__/api/projects-files.test.ts
git commit -m "feat: add POST /api/projects/[id]/files"
```

---

## Task 8: Project files API — delete

**Files:**
- Create: `app/api/projects/[id]/files/[fileId]/route.ts`
- Create: `__tests__/api/projects-files-id.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/projects-files-id.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { DELETE } from '@/app/api/projects/[id]/files/[fileId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    projectFile: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}))
jest.mock('@/lib/storage', () => ({
  deleteFile: jest.fn(),
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

function makeContext(id: string, fileId: string) {
  return { params: Promise.resolve({ id, fileId }) }
}

function makeRequest(id: string, fileId: string) {
  return new NextRequest(`http://localhost/api/projects/${id}/files/${fileId}`, { method: 'DELETE' })
}

const mockFile = {
  id: 'pf1',
  projectId: 'p1',
  name: 'notes.pdf',
  storageKey: 'projects/p1/uuid-notes.pdf',
  project: { userId: 'user-1' },
}

beforeEach(() => jest.clearAllMocks())

describe('DELETE /api/projects/[id]/files/[fileId]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('p1', 'pf1'), makeContext('p1', 'pf1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when file not found', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeRequest('p1', 'missing'), makeContext('p1', 'missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when file belongs to another user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-2' } })
    ;(prisma.projectFile.findUnique as jest.Mock).mockResolvedValue(mockFile)
    const res = await DELETE(makeRequest('p1', 'pf1'), makeContext('p1', 'pf1'))
    expect(res.status).toBe(404)
  })

  it('deletes from storage and DB', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findUnique as jest.Mock).mockResolvedValue(mockFile)
    ;(deleteFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.projectFile.delete as jest.Mock).mockResolvedValue({})

    const res = await DELETE(makeRequest('p1', 'pf1'), makeContext('p1', 'pf1'))

    expect(res.status).toBe(200)
    expect(deleteFile).toHaveBeenCalledWith('projects/p1/uuid-notes.pdf')
    expect(prisma.projectFile.delete).toHaveBeenCalledWith({ where: { id: 'pf1' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/api/projects-files-id.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/projects/[id]/files/[fileId]/route'`

- [ ] **Step 3: Create the route**

Create `app/api/projects/[id]/files/[fileId]/route.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/api/projects-files-id.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[id]/files/[fileId]/route.ts __tests__/api/projects-files-id.test.ts
git commit -m "feat: add DELETE /api/projects/[id]/files/[fileId]"
```

---

## Task 9: Extend pendingGeneration and guides POST to carry projectId

**Files:**
- Modify: `lib/pendingGeneration.ts`
- Modify: `app/api/guides/route.ts`
- Modify: `__tests__/pendingGeneration.test.ts`
- Modify: `__tests__/api/guides.test.ts`

- [ ] **Step 1: Write failing tests for pendingGeneration**

Open `__tests__/pendingGeneration.test.ts` and add this test to the existing suite (read the file first to know what's already there, then append):

```ts
it('preserves projectId and storedFileIds through set and peek', () => {
  setPending({ files: [], mode: 'math-cs', projectId: 'p1', storedFileIds: ['f1', 'f2'] })
  const result = peekPending()
  expect(result?.projectId).toBe('p1')
  expect(result?.storedFileIds).toEqual(['f1', 'f2'])
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest --no-coverage __tests__/pendingGeneration.test.ts
```

Expected: FAIL — type error or projectId is undefined

- [ ] **Step 3: Update pendingGeneration.ts**

Replace the contents of `lib/pendingGeneration.ts`:

```ts
import type { GuideMode } from '@/types/guide'

interface PendingGeneration {
  files: File[]
  mode: GuideMode
  projectId?: string
  storedFileIds?: string[]
}

let pending: PendingGeneration | null = null

export function setPending(data: PendingGeneration): void {
  pending = data
}

/** Read pending data without clearing it. */
export function peekPending(): PendingGeneration | null {
  return pending
}

/** Explicitly clear pending data (call on success or user dismissal). */
export function clearPending(): void {
  pending = null
}

/** Legacy: read and immediately clear. Kept for any existing callers. */
export function consumePending(): PendingGeneration | null {
  const p = pending
  pending = null
  return p
}
```

- [ ] **Step 4: Write failing test for guides POST with projectId**

Open `__tests__/api/guides.test.ts` and add this test inside the `describe('POST /api/guides')` block:

```ts
it('saves guide with projectId when provided', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.guide.create as jest.Mock).mockResolvedValue({})

  const body = { id: 'g1', title: 'Calculus', mode: 'math-cs', sections: [], projectId: 'p1' }
  const res = await POST(makeRequest('POST', body))

  expect(res.status).toBe(201)
  expect(prisma.guide.create).toHaveBeenCalledWith({
    data: { id: 'g1', userId: 'user-1', title: 'Calculus', mode: 'math-cs', content: [], projectId: 'p1' },
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npx jest --no-coverage __tests__/api/guides.test.ts
```

Expected: FAIL — projectId not included in prisma.guide.create call

- [ ] **Step 6: Update app/api/guides/route.ts POST**

In `app/api/guides/route.ts`, replace the `prisma.guide.create` call in the POST handler:

```ts
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
```

- [ ] **Step 7: Run all modified tests to verify they pass**

```bash
npx jest --no-coverage __tests__/pendingGeneration.test.ts __tests__/api/guides.test.ts
```

Expected: PASS — all tests passing

- [ ] **Step 8: Commit**

```bash
git add lib/pendingGeneration.ts app/api/guides/route.ts __tests__/pendingGeneration.test.ts __tests__/api/guides.test.ts
git commit -m "feat: propagate projectId through pendingGeneration and guide save"
```

---

## Task 10: Extend generate API to handle stored files

**Files:**
- Modify: `app/api/guides/generate/route.ts`

Tests for this route (`__tests__/api/GeneratePage.test.tsx` tests the page, not the route directly — the generate route itself is complex to unit test due to streaming). Add an integration-level test file.

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/guides-generate.test.ts`:

```ts
/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    projectFile: { findMany: jest.fn(), create: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  uploadFile: jest.fn(),
  getPresignedDownloadUrl: jest.fn(),
}))
jest.mock('@/lib/anthropic', () => ({
  getClient: jest.fn(),
  buildSystemPrompt: jest.fn(() => 'system'),
  fileToContentBlock: jest.fn(async (f: File) => ({ type: 'text', text: `content:${f.name}` })),
}))
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid'),
}))

import { POST } from '@/app/api/guides/generate/route'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { uploadFile, getPresignedDownloadUrl } from '@/lib/storage'

function makeFormData(
  files: { name: string; type: string; content: string }[],
  extra: Record<string, string> = {},
) {
  const fd = new FormData()
  files.forEach(f => fd.append('files', new File([f.content], f.name, { type: f.type })))
  Object.entries(extra).forEach(([k, v]) => fd.append(k, v))
  return new NextRequest('http://localhost/api/guides/generate', { method: 'POST', body: fd })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/guides/generate — stored files', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeFormData([{ name: 'a.txt', type: 'text/plain', content: 'hi' }]))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no files and no storedFileIds', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const res = await POST(makeFormData([], { mode: 'math-cs' }))
    expect(res.status).toBe(400)
  })

  it('fetches stored files from storage when storedFileIds provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findMany as jest.Mock).mockResolvedValue([
      { id: 'f1', projectId: 'p1', name: 'stored.txt', mimeType: 'text/plain', storageKey: 'projects/p1/stored.txt', size: 5 },
    ])
    ;(getPresignedDownloadUrl as jest.Mock).mockResolvedValue('https://storage.example.com/stored.txt')

    global.fetch = jest.fn().mockResolvedValueOnce({
      arrayBuffer: async () => new ArrayBuffer(5),
    }) as jest.Mock

    const mockStream = {
      on: jest.fn((event: string, cb: (chunk: string) => void) => {
        if (event === 'text') cb('{"title":"T","sections":[]}')
        return mockStream
      }),
      finalMessage: jest.fn().mockResolvedValue({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }),
    }
    const { getClient } = await import('@/lib/anthropic')
    ;(getClient as jest.Mock).mockReturnValue({ messages: { stream: jest.fn(() => mockStream) } })

    const res = await POST(makeFormData([], { mode: 'math-cs', storedFileIds: 'f1', projectId: 'p1' }))

    expect(getPresignedDownloadUrl).toHaveBeenCalledWith('projects/p1/stored.txt')
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('uploads new files to project when projectId provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.projectFile.findMany as jest.Mock).mockResolvedValue([])
    ;(uploadFile as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.projectFile.create as jest.Mock).mockResolvedValue({})

    const mockStream = {
      on: jest.fn((event: string, cb: (chunk: string) => void) => {
        if (event === 'text') cb('{"title":"T","sections":[]}')
        return mockStream
      }),
      finalMessage: jest.fn().mockResolvedValue({ stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }),
    }
    const { getClient } = await import('@/lib/anthropic')
    ;(getClient as jest.Mock).mockReturnValue({ messages: { stream: jest.fn(() => mockStream) } })

    await POST(makeFormData([{ name: 'new.txt', type: 'text/plain', content: 'hello' }], { mode: 'math-cs', projectId: 'p1' }))

    expect(uploadFile).toHaveBeenCalledWith('projects/p1/test-uuid-new.txt', expect.any(Buffer), 'text/plain')
    expect(prisma.projectFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1', name: 'new.txt' }),
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/api/guides-generate.test.ts
```

Expected: FAIL — tests fail because the generate route doesn't handle storedFileIds yet.

- [ ] **Step 3: Update app/api/guides/generate/route.ts**

Replace the full file contents:

```ts
import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient, buildSystemPrompt, fileToContentBlock } from '@/lib/anthropic'
import type { ContentBlock } from '@/lib/anthropic'
import type { Guide, GuideSection, ContentElement, GuideMode } from '@/types/guide'
import logger from '@/lib/logger'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { uploadFile, getPresignedDownloadUrl } from '@/lib/storage'

const ALLOWED_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'])

interface ClaudeElement {
  type: ContentElement['type']
  content?: string
  level?: 2 | 3
  language?: string
  events?: ContentElement['events']
}

interface ClaudeSection {
  heading: string
  elements: ClaudeElement[]
}

interface ClaudeGuide {
  title: string
  sections: ClaudeSection[]
}

function isClaudeGuide(v: unknown): v is ClaudeGuide {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as ClaudeGuide).title === 'string' &&
    Array.isArray((v as ClaudeGuide).sections)
  )
}

function assignIds(raw: ClaudeGuide, mode: GuideMode): Guide {
  const sections: GuideSection[] = raw.sections.map(s => ({
    id: randomUUID(),
    heading: s.heading,
    elements: s.elements.map(el => ({
      id: randomUUID(),
      type: el.type,
      content: el.content ?? '',
      ...(el.level !== undefined && { level: el.level }),
      ...(el.language !== undefined && { language: el.language }),
      ...(el.events !== undefined && { events: el.events }),
    } as ContentElement)),
  }))

  return {
    id: randomUUID(),
    title: raw.title,
    mode,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    sections,
  }
}

export type GenerateEvent =
  | { type: 'stage'; stage: 'parsing' | 'analyzing' | 'writing' | 'rendering' }
  | { type: 'done'; guide: Guide }
  | { type: 'error'; message: string }

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const log = logger.child({ route: 'POST /api/guides/generate' })
  const encoder = new TextEncoder()

  function send(controller: ReadableStreamDefaultController, event: GenerateEvent) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const rawMode = formData.get('mode') ?? 'math-cs'
  const projectId = formData.get('projectId') as string | null
  const storedFileIdsRaw = formData.get('storedFileIds') as string | null
  const storedFileIds = storedFileIdsRaw ? storedFileIdsRaw.split(',').filter(Boolean) : []

  if (rawMode !== 'math-cs' && rawMode !== 'humanities') {
    log.warn({ rawMode }, 'invalid mode')
    return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400 })
  }
  const mode: GuideMode = rawMode

  if (files.length === 0 && storedFileIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No files provided' }), { status: 400 })
  }

  const badFile = files.find(f => !ALLOWED_TYPES.has(f.type))
  if (badFile) {
    return new Response(
      JSON.stringify({ error: `Unsupported file type: ${badFile.type}. Allowed: PDF, plain text, markdown.` }),
      { status: 400 },
    )
  }

  const MAX_FILES = 5
  const MAX_BYTES = 10 * 1024 * 1024

  if (files.length > MAX_FILES) {
    return new Response(JSON.stringify({ error: `Maximum ${MAX_FILES} files allowed` }), { status: 400 })
  }
  const oversized = files.find(f => f.size > MAX_BYTES)
  if (oversized) {
    return new Response(
      JSON.stringify({ error: `File "${oversized.name}" exceeds 10 MB limit` }),
      { status: 400 },
    )
  }

  log.info({ mode, files: files.map(f => ({ name: f.name, size: f.size })), storedFileIds, projectId }, 'starting generation')

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: 'stage', stage: 'parsing' })

        // Save new uploaded files to project (if projectId provided)
        if (projectId && files.length > 0) {
          for (const file of files) {
            const key = `projects/${projectId}/${randomUUID()}-${file.name}`
            const buffer = Buffer.from(await file.arrayBuffer())
            await uploadFile(key, buffer, file.type)
            await prisma.projectFile.create({
              data: { projectId, name: file.name, size: file.size, mimeType: file.type, storageKey: key },
            })
          }
        }

        // Build content blocks from uploaded files
        let uploadedBlocks: ContentBlock[]
        try {
          uploadedBlocks = await Promise.all(files.map(fileToContentBlock))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to process uploaded files'
          log.error({ err }, 'failed to build content blocks from uploads')
          send(controller, { type: 'error', message })
          controller.close()
          return
        }

        // Build content blocks from stored files
        let storedBlocks: ContentBlock[] = []
        if (storedFileIds.length > 0) {
          try {
            const projectFiles = await prisma.projectFile.findMany({
              where: {
                id: { in: storedFileIds },
                project: { userId: session.user!.id },
              },
            })
            storedBlocks = await Promise.all(
              projectFiles.map(async pf => {
                const url = await getPresignedDownloadUrl(pf.storageKey)
                const res = await fetch(url)
                const buffer = Buffer.from(await res.arrayBuffer())
                const file = new File([buffer], pf.name, { type: pf.mimeType })
                return fileToContentBlock(file)
              }),
            )
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch stored files'
            log.error({ err }, 'failed to fetch stored files')
            send(controller, { type: 'error', message })
            controller.close()
            return
          }
        }

        const contentBlocks: ContentBlock[] = [...storedBlocks, ...uploadedBlocks]
        log.info({ count: contentBlocks.length }, 'content blocks ready')

        send(controller, { type: 'stage', stage: 'analyzing' })
        log.info({ model: 'claude-sonnet-4-6', mode }, 'calling Claude')

        const client = getClient()
        let rawText = ''
        try {
          const claudeStream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            system: buildSystemPrompt(mode),
            messages: [
              {
                role: 'user',
                content: [
                  ...contentBlocks,
                  { type: 'text', text: 'Generate a study guide from the material above.' },
                ],
              },
            ],
          })

          let writingSignalled = false
          claudeStream.on('text', chunk => {
            rawText += chunk
            if (!writingSignalled) {
              writingSignalled = true
              send(controller, { type: 'stage', stage: 'writing' })
            }
          })

          const finalMessage = await claudeStream.finalMessage()
          log.info({
            stop_reason: finalMessage.stop_reason,
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
          }, 'Claude finished')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'AI service error'
          log.error({ err }, 'Anthropic API error')
          send(controller, { type: 'error', message })
          controller.close()
          return
        }

        send(controller, { type: 'stage', stage: 'rendering' })

        if (!rawText) {
          send(controller, { type: 'error', message: 'Claude returned an empty response.' })
          controller.close()
          return
        }

        const jsonText = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/, '')
          .trim()

        let parsed: ClaudeGuide
        try {
          parsed = JSON.parse(jsonText)
        } catch {
          log.error({ rawText: rawText.slice(0, 500) }, 'Claude returned invalid JSON')
          send(controller, { type: 'error', message: 'Claude returned invalid JSON' })
          controller.close()
          return
        }

        if (!isClaudeGuide(parsed)) {
          log.error({ keys: Object.keys(parsed as object) }, 'unexpected JSON structure')
          send(controller, { type: 'error', message: 'Claude returned unexpected JSON structure' })
          controller.close()
          return
        }

        let guide: Guide
        try {
          guide = assignIds(parsed, mode)
        } catch {
          send(controller, { type: 'error', message: 'Failed to process Claude response' })
          controller.close()
          return
        }

        log.info({ id: guide.id, title: guide.title, sections: guide.sections.length }, 'guide generated')
        send(controller, { type: 'done', guide })
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error'
        log.error({ err }, 'unhandled error in generation stream')
        send(controller, { type: 'error', message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/api/guides-generate.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all tests passing

- [ ] **Step 6: Commit**

```bash
git add app/api/guides/generate/route.ts __tests__/api/guides-generate.test.ts
git commit -m "feat: extend generate API to handle stored project files"
```

---

## Task 11: Extend generate page to pass projectId on save

**Files:**
- Modify: `app/generate/page.tsx`

- [ ] **Step 1: Update the save call in generate/page.tsx**

In `app/generate/page.tsx`, find the section inside `runGeneration` where `event.type === 'done'` is handled. It currently reads:

```ts
const saveRes = await fetch('/api/guides', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(event.guide),
})
```

Replace with:

```ts
const saveRes = await fetch('/api/guides', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...event.guide,
    projectId: peekPending()?.projectId,
  }),
})
```

- [ ] **Step 2: Also pass storedFileIds and projectId in the FormData sent to generate**

In `app/generate/page.tsx`, find where formData is assembled in `runGeneration`:

```ts
const formData = new FormData()
pending.files.forEach(f => formData.append('files', f))
formData.append('mode', pending.mode)
```

Replace with:

```ts
const formData = new FormData()
pending.files.forEach(f => formData.append('files', f))
formData.append('mode', pending.mode)
if (pending.projectId) formData.append('projectId', pending.projectId)
if (pending.storedFileIds?.length) formData.append('storedFileIds', pending.storedFileIds.join(','))
```

- [ ] **Step 3: Run existing generate page tests**

```bash
npx jest --no-coverage __tests__/GeneratePage.test.tsx
```

Expected: PASS — existing tests still passing

- [ ] **Step 4: Commit**

```bash
git add app/generate/page.tsx
git commit -m "feat: pass projectId and storedFileIds from generate page to API"
```

---

## Task 12: Add Groups link to Navbar

**Files:**
- Modify: `components/Navbar.tsx`
- Modify: `__tests__/Navbar.test.tsx`

- [ ] **Step 1: Write failing test**

In `__tests__/Navbar.test.tsx`, add a test inside the `describe('Navbar')` block:

```ts
it('renders Groups link when authenticated', async () => {
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', name: 'Jake' } })
  render(await Navbar())
  expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest --no-coverage __tests__/Navbar.test.tsx
```

Expected: FAIL — unable to find link with name /groups/i

- [ ] **Step 3: Update Navbar.tsx**

Replace the contents of `components/Navbar.tsx`:

```tsx
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import SignOutButton from './SignOutButton'
import { auth } from '@/auth'

export default async function Navbar() {
  const session = await auth()

  return (
    <nav
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b px-6"
      style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
    >
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight"
        style={{ color: 'var(--foreground)' }}
      >
        tldr.
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {session?.user ? (
          <div className="flex items-center gap-4">
            <Link
              href="/groups"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--muted)' }}
            >
              Groups
            </Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/9.x/shapes/svg?seed=${session.user.id}`}
              alt="avatar"
              className="w-7 h-7 rounded-full"
            />
            <SignOutButton />
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--muted)' }}
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/Navbar.test.tsx
```

Expected: PASS — all Navbar tests passing

- [ ] **Step 5: Commit**

```bash
git add components/Navbar.tsx __tests__/Navbar.test.tsx
git commit -m "feat: add Groups link to Navbar"
```

---

## Task 13: Groups list page

**Files:**
- Create: `app/groups/page.tsx`
- Create: `__tests__/GroupsPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/GroupsPage.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import GroupsPage from '@/app/groups/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] })
})

describe('GroupsPage (/groups)', () => {
  it('renders the Groups heading', async () => {
    render(<GroupsPage />)
    await waitFor(() => {
      expect(screen.getByText(/groups/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no groups exist', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] })
    render(<GroupsPage />)
    await waitFor(() => {
      expect(screen.getByText(/no groups yet/i)).toBeInTheDocument()
    })
  })

  it('renders group cards when groups exist', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'p1', name: 'Bio Notes', createdAt: 'Apr 11, 2026', fileCount: 2, guideCount: 3 },
      ],
    })
    render(<GroupsPage />)
    await waitFor(() => {
      expect(screen.getByText('Bio Notes')).toBeInTheDocument()
    })
  })

  it('shows new group form when button is clicked', async () => {
    render(<GroupsPage />)
    await waitFor(() => screen.getByText(/new group/i))
    fireEvent.click(screen.getByText(/new group/i))
    expect(screen.getByPlaceholderText(/group name/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/GroupsPage.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/groups/page'`

- [ ] **Step 3: Create app/groups/page.tsx**

Create `app/groups/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectCardData } from '@/types/project'

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<ProjectCardData[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(setGroups)
      .catch(() => {})
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const group: ProjectCardData = await res.json()
        router.push(`/groups/${group.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-10">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <button
            onClick={() => setShowForm(v => !v)}
            className="rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            New Group
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Group name"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        )}

        {groups.length === 0 ? (
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
            No groups yet — create one to save files and generate multiple guides on the same topic.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map(g => (
              <a
                key={g.id}
                href={`/groups/${g.id}`}
                className="flex flex-col gap-2 rounded-lg border p-4 transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{g.name}</span>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>{g.fileCount} {g.fileCount === 1 ? 'file' : 'files'}</span>
                  <span>·</span>
                  <span>{g.guideCount} {g.guideCount === 1 ? 'guide' : 'guides'}</span>
                  <span>·</span>
                  <span>{g.createdAt}</span>
                </div>
              </a>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/GroupsPage.test.tsx
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/groups/page.tsx __tests__/GroupsPage.test.tsx
git commit -m "feat: add /groups list page"
```

---

## Task 14: Group detail page

**Files:**
- Create: `app/groups/[id]/page.tsx`
- Create: `app/groups/[id]/GroupPageClient.tsx`
- Create: `__tests__/GroupPageClient.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/GroupPageClient.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import GroupPageClient from '@/app/groups/[id]/GroupPageClient'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/pendingGeneration', () => ({
  setPending: jest.fn(),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const mockProject = {
  id: 'p1',
  name: 'Bio Notes',
  createdAt: 'Apr 11, 2026',
  files: [
    { id: 'f1', projectId: 'p1', name: 'chapter1.pdf', size: 102400, mimeType: 'application/pdf', storageKey: 'projects/p1/f1.pdf', uploadedAt: 'Apr 11, 2026' },
  ],
  guides: [
    { id: 'g1', title: 'Bio Guide', mode: 'humanities', createdAt: 'Apr 11, 2026' },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true, json: async () => mockProject })
})

describe('GroupPageClient', () => {
  it('renders the project name', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Bio Notes')).toBeInTheDocument()
    })
  })

  it('renders stored files', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('chapter1.pdf')).toBeInTheDocument()
    })
  })

  it('renders guide cards', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByText('Bio Guide')).toBeInTheDocument()
    })
  })

  it('shows generate section with stored file checkbox', async () => {
    render(<GroupPageClient projectId="p1" />)
    await waitFor(() => {
      expect(screen.getByLabelText('chapter1.pdf')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --no-coverage __tests__/GroupPageClient.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/groups/[id]/GroupPageClient'`

- [ ] **Step 3: Create GroupPageClient.tsx**

Create `app/groups/[id]/GroupPageClient.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import GuideCard from '@/components/GuideCard'
import UploadZone from '@/components/UploadZone'
import { setPending } from '@/lib/pendingGeneration'
import type { ProjectDetail, ProjectFile } from '@/types/project'
import type { GuideMode } from '@/types/guide'

export default function GroupPageClient({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [mode, setMode] = useState<GuideMode>('math-cs')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then((data: ProjectDetail) => {
        setProject(data)
        setSelectedFileIds(new Set(data.files.map(f => f.id)))
      })
      .catch(() => {})
  }, [projectId])

  function toggleFile(id: string) {
    setSelectedFileIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteFile(file: ProjectFile) {
    const res = await fetch(`/api/projects/${projectId}/files/${file.id}`, { method: 'DELETE' })
    if (res.ok) {
      setProject(prev => prev ? { ...prev, files: prev.files.filter(f => f.id !== file.id) } : prev)
      setSelectedFileIds(prev => { const next = new Set(prev); next.delete(file.id); return next })
    }
  }

  async function handleAddFiles(files: File[]) {
    if (files.length === 0) return
    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      const res = await fetch(`/api/projects/${projectId}/files`, { method: 'POST', body: formData })
      if (res.ok) {
        const saved: ProjectFile[] = await res.json()
        setProject(prev => prev ? { ...prev, files: [...saved, ...prev.files] } : prev)
        setSelectedFileIds(prev => { const next = new Set(prev); saved.forEach(f => next.add(f.id)); return next })
      }
    } finally {
      setUploading(false)
    }
  }

  function handleGenerate() {
    if (selectedFileIds.size === 0 && newFiles.length === 0) return
    setPending({
      files: newFiles,
      mode,
      projectId,
      storedFileIds: Array.from(selectedFileIds),
    })
    router.push('/generate')
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl flex flex-col gap-10">

        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>

        {/* Files section */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Files
          </h2>

          {project.files.length > 0 && (
            <ul className="flex flex-col gap-2">
              {project.files.map(f => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm truncate max-w-xs" style={{ color: 'var(--foreground)' }}>{f.name}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{formatBytes(f.size)} · {f.uploadedAt}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(f)}
                    className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                    style={{ color: 'var(--muted)' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              multiple
              className="hidden"
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                handleAddFiles(files)
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-opacity disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--surface)' }}
            >
              {uploading ? 'Uploading…' : '+ Add files'}
            </button>
          </div>
        </section>

        {/* Guides section */}
        <section className="flex flex-col gap-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Guides
          </h2>

          {project.guides.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {project.guides.map(guide => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          )}

          {/* Generate new guide */}
          <div
            className="flex flex-col gap-4 rounded-xl border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Generate a new guide</p>

            {project.files.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Include stored files:</p>
                {project.files.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.has(f.id)}
                      onChange={() => toggleFile(f.id)}
                      aria-label={f.name}
                    />
                    <span style={{ color: 'var(--foreground)' }}>{f.name}</span>
                  </label>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Or upload additional files:</p>
              <UploadZone onFilesChange={setNewFiles} />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>Mode:</span>
              <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {(['math-cs', 'humanities'] as GuideMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="px-4 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      background: mode === m ? 'var(--accent)' : 'var(--surface)',
                      color: mode === m ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {m === 'math-cs' ? 'Math / CS' : 'Humanities'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={selectedFileIds.size === 0 && newFiles.length === 0}
              className="self-start flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Generate Guide →
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create app/groups/[id]/page.tsx**

Create `app/groups/[id]/page.tsx`:

```tsx
import GroupPageClient from './GroupPageClient'

type Props = { params: Promise<{ id: string }> }

export default async function GroupPage({ params }: Props) {
  const { id } = await params
  return <GroupPageClient projectId={id} />
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest --no-coverage __tests__/GroupPageClient.test.tsx
```

Expected: PASS — 4 tests passing

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests passing

- [ ] **Step 7: Commit**

```bash
git add app/groups/[id]/page.tsx app/groups/[id]/GroupPageClient.tsx __tests__/GroupPageClient.test.tsx
git commit -m "feat: add /groups/[id] group detail page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| Project model (id, userId, name, createdAt) | Task 2 |
| ProjectFile model (id, projectId, name, size, mimeType, storageKey) | Task 2 |
| Guide.projectId optional FK | Task 2 |
| Tigris S3 storage wrapper | Task 4 |
| GET/POST /api/projects | Task 5 |
| GET/DELETE /api/projects/[id] | Task 6 |
| POST /api/projects/[id]/files | Task 7 |
| DELETE /api/projects/[id]/files/[fileId] | Task 8 |
| Extended pendingGeneration (projectId, storedFileIds) | Task 9 |
| Extended guides POST (projectId) | Task 9 |
| Extended generate API (fetch stored files, save new to project) | Task 10 |
| Generate page passes projectId + storedFileIds | Task 11 |
| Groups link in Navbar (authenticated only) | Task 12 |
| /groups list page with create form | Task 13 |
| /groups/[id] with file management + guide generation | Task 14 |
| Solo flow unchanged | Generate page changes are additive only |
| OnDelete SetNull for Guide → Project | Task 2 |
| OnDelete Cascade for Project → ProjectFile | Task 2 |
| Files deleted from storage on project delete | Task 6 |

**Type consistency check:**
- `ProjectFile.storageKey` used consistently across storage.ts, files API, delete API, and generate route.
- `storedFileIds` is a `string[]` in pendingGeneration and joined as comma-separated string in FormData — split back with `.split(',').filter(Boolean)` in generate route. Consistent.
- `getPresignedDownloadUrl` signature in storage.ts matches usage in generate route.
- Context type `{ params: Promise<{ id: string }> }` used consistently across all new dynamic routes.

**No placeholders detected.**
