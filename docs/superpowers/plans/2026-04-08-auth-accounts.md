# Auth & Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full-stack user authentication (email/password + Google OAuth) and migrate guide storage from localStorage to Postgres.

**Architecture:** Auth.js v5 handles authentication with a Prisma adapter and database sessions. Guide data moves from browser localStorage to Postgres on Railway, accessed through three new REST API routes scoped to the authenticated user. A single `middleware.ts` enforces the full auth wall — all routes except `/login`, `/register`, and `/api/auth/*` redirect unauthenticated users to `/login`.

**Tech Stack:** next-auth@beta, @auth/prisma-adapter, Prisma ORM, @prisma/client, bcryptjs, Postgres (Railway)

> **Note:** Before touching any Next.js APIs, read the relevant guide in `node_modules/next/dist/docs/` — this version (16.2.2) may differ from training data.

---

## File Map

**New files:**
- `prisma/schema.prisma` — Auth.js required tables + Guide table
- `lib/db.ts` — PrismaClient singleton (hot-reload safe)
- `auth.ts` — Auth.js config: providers, Prisma adapter, session callback
- `middleware.ts` — route protection
- `types/next-auth.d.ts` — TypeScript augmentation to expose `session.user.id`
- `app/api/auth/register/route.ts` — POST: create user with hashed password
- `app/api/guides/route.ts` — GET: list user's guides; POST: save guide
- `app/api/guides/[id]/route.ts` — GET: fetch single guide (ownership-checked)
- `app/login/page.tsx` — sign-in page (credentials form + Google button)
- `app/register/page.tsx` — registration form
- `components/SignOutButton.tsx` — client component wrapping `signOut`
- `__tests__/api/register.test.ts`
- `__tests__/api/guides.test.ts`
- `__tests__/api/guides-id.test.ts`

**Modified files:**
- `components/Navbar.tsx` — make async server component; call `auth()`; show avatar + SignOutButton
- `app/generate/page.tsx` — replace `saveGuide()` with `POST /api/guides`
- `app/guide/[id]/GuideClientLoader.tsx` — replace localStorage read with `GET /api/guides/:id`
- `app/page.tsx` — replace `listGuides()` with `fetch('/api/guides')`
- `__tests__/Navbar.test.tsx` — mock `auth`, test both unauthenticated and authenticated states
- `__tests__/components/GuideClientLoader.test.tsx` — mock `fetch` instead of localStorage

**Deleted files:**
- `lib/guideStorage.ts`

---

## Task 1: Install dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install next-auth@beta @auth/prisma-adapter @prisma/client bcryptjs
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D prisma @types/bcryptjs
```

- [ ] **Step 3: Verify installed versions**

```bash
node -e "console.log(require('./node_modules/next-auth/package.json').version)"
node -e "console.log(require('./node_modules/@prisma/client/package.json').version)"
```

Expected: prints version strings without error.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add auth and prisma dependencies"
```

---

## Task 2: Prisma schema and DB client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
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

model Guide {
  id        String   @id
  userId    String
  title     String
  mode      String
  content   Json
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Create `lib/db.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Run migration** (requires `DATABASE_URL` set in `.env.local`)

```bash
npx prisma migrate dev --name init
```

Expected: `✔ Generated Prisma Client` and migration files created in `prisma/migrations/`.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/db.ts
git commit -m "feat: add prisma schema and db client"
```

---

## Task 3: Auth.js config and TypeScript augmentation

**Files:**
- Create: `auth.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: Create `auth.ts`**

```ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user?.password) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        )
        if (!valid) return null
        return user
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

- [ ] **Step 2: Create `types/next-auth.d.ts`**

```ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
```

- [ ] **Step 3: Add Auth.js route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 4: Set required env vars in `.env.local`**

Add to `.env.local` (create if it doesn't exist):

```
AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_GOOGLE_ID=<from Google Cloud Console>
AUTH_GOOGLE_SECRET=<from Google Cloud Console>
DATABASE_URL=<Railway Postgres connection string>
```

- [ ] **Step 5: Commit**

```bash
git add auth.ts types/next-auth.d.ts app/api/auth/
git commit -m "feat: add auth.js config with credentials and google providers"
```

---

## Task 4: Middleware route protection

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

export default auth(req => {
  const { pathname } = req.nextUrl

  const isPublic =
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/api/auth')

  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware for route protection"
```

---

## Task 5: Registration API route

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `__tests__/api/register.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/register.test.ts`:

```ts
import { POST } from '@/app/api/auth/register/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-pw'),
}))

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/auth/register', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'secret123' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when email already taken', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' })
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret123' }))
    expect(res.status).toBe(409)
  })

  it('creates user with hashed password and returns 201', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.user.create as jest.Mock).mockResolvedValue({ id: 'new-user' })

    const res = await POST(makeRequest({ name: 'Jake', email: 'a@b.com', password: 'secret123' }))

    expect(res.status).toBe(201)
    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12)
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { name: 'Jake', email: 'a@b.com', password: 'hashed-pw' },
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/api/register.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/auth/register/route'`

- [ ] **Step 3: Create `app/api/auth/register/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(body.password, 12)
  await prisma.user.create({
    data: {
      name: body.name ?? null,
      email: body.email,
      password: hashed,
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/api/register.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/register/ __tests__/api/register.test.ts
git commit -m "feat: add registration API route"
```

---

## Task 6: Guides list and save API route

**Files:**
- Create: `app/api/guides/route.ts`
- Create: `__tests__/api/guides.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/guides.test.ts`:

```ts
import { GET, POST } from '@/app/api/guides/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    guide: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function makeRequest(method: string, body?: object) {
  return new NextRequest('http://localhost/api/guides', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/guides', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns guides scoped to current user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-08T00:00:00Z')
    ;(prisma.guide.findMany as jest.Mock).mockResolvedValue([
      { id: 'g1', title: 'Calculus', mode: 'math-cs', createdAt: mockDate },
    ])

    const res = await GET(makeRequest('GET'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.guide.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(json[0].id).toBe('g1')
    expect(json[0].title).toBe('Calculus')
    expect(typeof json[0].createdAt).toBe('string')
  })
})

describe('POST /api/guides', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { id: 'g1', title: 'Test', mode: 'math-cs', sections: [] }))
    expect(res.status).toBe(401)
  })

  it('saves guide with userId and returns 201', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.guide.create as jest.Mock).mockResolvedValue({})

    const body = { id: 'g1', title: 'Calculus', mode: 'math-cs', sections: [], createdAt: 'Apr 8, 2026' }
    const res = await POST(makeRequest('POST', body))

    expect(res.status).toBe(201)
    expect(prisma.guide.create).toHaveBeenCalledWith({
      data: { id: 'g1', userId: 'user-1', title: 'Calculus', mode: 'math-cs', content: [] },
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/api/guides.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/guides/route'`

- [ ] **Step 3: Create `app/api/guides/route.ts`**

```ts
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

  const guides: GuideCardData[] = rows.map(r => ({
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
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/api/guides.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/guides/route.ts __tests__/api/guides.test.ts
git commit -m "feat: add guides list and save API routes"
```

---

## Task 7: Single guide API route

**Files:**
- Create: `app/api/guides/[id]/route.ts`
- Create: `__tests__/api/guides-id.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/guides-id.test.ts`:

```ts
import { GET } from '@/app/api/guides/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    guide: {
      findUnique: jest.fn(),
    },
  },
}))

import { auth } from '@/auth'
import { prisma } from '@/lib/db'

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/guides/${id}`)
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/guides/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('g1'), makeContext('g1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when guide does not exist', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.guide.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest('missing'), makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when guide belongs to a different user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.guide.findUnique as jest.Mock).mockResolvedValue({
      id: 'g1', userId: 'user-2', title: 'Test', mode: 'math-cs', content: [], createdAt: new Date(),
    })
    const res = await GET(makeRequest('g1'), makeContext('g1'))
    expect(res.status).toBe(404)
  })

  it('returns the guide when it belongs to the current user', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const mockDate = new Date('2026-04-08T00:00:00Z')
    ;(prisma.guide.findUnique as jest.Mock).mockResolvedValue({
      id: 'g1', userId: 'user-1', title: 'Calculus', mode: 'math-cs', content: [{ id: 's1' }], createdAt: mockDate,
    })

    const res = await GET(makeRequest('g1'), makeContext('g1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('g1')
    expect(json.title).toBe('Calculus')
    expect(json.sections).toEqual([{ id: 's1' }])
    expect(typeof json.createdAt).toBe('string')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/api/guides-id.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/guides/[id]/route'`

- [ ] **Step 3: Create `app/api/guides/[id]/route.ts`**

```ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/api/guides-id.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/guides/[id]/" __tests__/api/guides-id.test.ts
git commit -m "feat: add single guide API route"
```

---

## Task 8: Protect the generate API route

**Files:**
- Modify: `app/api/guides/generate/route.ts`

- [ ] **Step 1: Add auth check at the top of the POST handler**

In `app/api/guides/generate/route.ts`, add this import at the top:

```ts
import { auth } from '@/auth'
```

Then add this block as the **first thing inside the `POST` function body**, before `const formData = await request.formData()`:

```ts
const session = await auth()
if (!session?.user?.id) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/guides/generate/route.ts
git commit -m "feat: require auth on guide generation route"
```

---

## Task 9: Update generate page — replace saveGuide

**Files:**
- Modify: `app/generate/page.tsx`

- [ ] **Step 1: Replace `saveGuide` call with `POST /api/guides`**

In `app/generate/page.tsx`:

Remove the import:
```ts
import { saveGuide } from '@/lib/guideStorage'
```

Replace the `saveGuide(event.guide)` line (inside the `event.type === 'done'` branch) with:

```ts
await fetch('/api/guides', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(event.guide),
})
```

The surrounding block should then look like:

```ts
} else if (event.type === 'done') {
  setCurrentStage(STAGES.length - 1)
  await fetch('/api/guides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event.guide),
  })
  router.push(`/guide/${event.guide.id}`)
  return
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/generate/page.tsx
git commit -m "feat: save generated guide to API instead of localStorage"
```

---

## Task 10: Update GuideClientLoader — replace localStorage with fetch

**Files:**
- Modify: `app/guide/[id]/GuideClientLoader.tsx`
- Modify: `__tests__/components/GuideClientLoader.test.tsx`

- [ ] **Step 1: Update tests first**

Replace the entire contents of `__tests__/components/GuideClientLoader.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import GuideClientLoader from '@/app/guide/[id]/GuideClientLoader'
import type { Guide } from '@/types/guide'

jest.mock('@/app/guide/[id]/GuideView', () => ({
  __esModule: true,
  default: ({ guide }: { guide: Guide }) => <div>{guide.title}</div>,
}))

const MOCK_GUIDE: Guide = {
  id: 'test-123',
  title: 'Test Guide',
  mode: 'math-cs',
  createdAt: 'Apr 8, 2026',
  sections: [
    {
      id: 's1',
      heading: 'Introduction',
      elements: [{ id: 'e1', type: 'paragraph', content: 'Hello world' }],
    },
  ],
}

beforeEach(() => jest.resetAllMocks())

it('renders the guide title when fetch succeeds', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(MOCK_GUIDE),
  } as Response)

  render(<GuideClientLoader id="test-123" />)
  await waitFor(() => expect(screen.getByText('Test Guide')).toBeInTheDocument())
  expect(fetch).toHaveBeenCalledWith('/api/guides/test-123')
})

it('shows a not-found message when fetch returns 404', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
  } as Response)

  render(<GuideClientLoader id="missing-id" />)
  await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run updated tests — verify they fail**

```bash
npx jest __tests__/components/GuideClientLoader.test.tsx --no-coverage
```

Expected: FAIL (GuideClientLoader still reads from localStorage)

- [ ] **Step 3: Replace localStorage reads in `GuideClientLoader.tsx`**

Replace the entire `useEffect` body in `app/guide/[id]/GuideClientLoader.tsx`:

```ts
useEffect(() => {
  fetch(`/api/guides/${id}`)
    .then(res => {
      if (!res.ok) { setGuide('not-found'); return }
      return res.json()
    })
    .then(data => {
      if (data) setGuide(data as Guide)
    })
    .catch(() => setGuide('not-found'))
}, [id])
```

Remove the old `useEffect` that referenced `localStorage`.

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/components/GuideClientLoader.test.tsx --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/guide/[id]/GuideClientLoader.tsx" __tests__/components/GuideClientLoader.test.tsx
git commit -m "feat: load guide from API instead of localStorage"
```

---

## Task 11: Update home page and delete guideStorage

**Files:**
- Modify: `app/page.tsx`
- Delete: `lib/guideStorage.ts`

- [ ] **Step 1: Replace `listGuides()` call in `app/page.tsx`**

Remove the import:
```ts
import { listGuides } from '@/lib/guideStorage'
```

Replace the `useEffect` that calls `listGuides()`:
```ts
useEffect(() => {
  fetch('/api/guides')
    .then(r => r.json())
    .then(setGuides)
    .catch(() => {})
}, [])
```

- [ ] **Step 2: Delete `lib/guideStorage.ts`**

```bash
rm lib/guideStorage.ts
```

- [ ] **Step 3: Verify TypeScript compiles with no guideStorage references**

```bash
npx tsc --noEmit
```

Expected: no errors. If any file still imports from `@/lib/guideStorage`, fix those imports now.

- [ ] **Step 4: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git rm lib/guideStorage.ts
git commit -m "feat: load guide list from API, remove localStorage storage"
```

---

## Task 12: Update Navbar — server component with avatar and sign-out

**Files:**
- Modify: `components/Navbar.tsx`
- Create: `components/SignOutButton.tsx`
- Modify: `__tests__/Navbar.test.tsx`

- [ ] **Step 1: Update Navbar test**

Replace the entire contents of `__tests__/Navbar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import Navbar from '@/components/Navbar'

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/components/SignOutButton', () => ({
  default: () => <button>Sign out</button>,
}))

import { auth } from '@/auth'

describe('Navbar', () => {
  it('renders the brand name', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    render(await Navbar())
    expect(screen.getByText('reduce')).toBeInTheDocument()
  })

  it('renders sign in link when not authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    render(await Navbar())
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders avatar and sign out when authenticated', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', name: 'Jake' } })
    render(await Navbar())
    expect(screen.getByRole('img', { name: /avatar/i })).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run updated tests — verify they fail**

```bash
npx jest __tests__/Navbar.test.tsx --no-coverage
```

Expected: FAIL (Navbar not yet async, doesn't call auth)

- [ ] **Step 3: Create `components/SignOutButton.tsx`**

```tsx
'use client'

import { signOut } from 'next-auth/react'

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-sm transition-colors hover:opacity-80"
      style={{ color: 'var(--muted)' }}
    >
      Sign out
    </button>
  )
}
```

- [ ] **Step 4: Replace `components/Navbar.tsx`**

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
        reduce
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {session?.user ? (
          <div className="flex items-center gap-2">
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

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx jest __tests__/Navbar.test.tsx --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add components/Navbar.tsx components/SignOutButton.tsx __tests__/Navbar.test.tsx
git commit -m "feat: update navbar with auth-aware avatar and sign-out button"
```

---

## Task 13: Login page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create `app/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password')
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#ef4444', background: '#fef2f2' }}>
              {error}
            </p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Continue with Google
        </button>

        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium" style={{ color: 'var(--accent)' }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/login/
git commit -m "feat: add login page"
```

---

## Task 14: Register page

**Files:**
- Create: `app/register/page.tsx`

- [ ] **Step 1: Create `app/register/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Registration failed')
      setLoading(false)
      return
    }

    await signIn('credentials', { email, password, callbackUrl: '/' })
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#ef4444', background: '#fef2f2' }}>
              {error}
            </p>
          )}
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          Continue with Google
        </button>

        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/register/
git commit -m "feat: add registration page"
```

---

## Task 15: Railway deployment setup

**Files:** Railway dashboard (no code changes)

- [ ] **Step 1: Add Postgres service on Railway**

In the Railway dashboard: add a new Postgres service to the project, then link it to the app service. Copy the `DATABASE_URL` connection string.

- [ ] **Step 2: Set environment variables on Railway**

In the app service's Variables tab, add:

```
DATABASE_URL        <postgres connection string from step 1>
AUTH_SECRET         <generate: openssl rand -base64 32>
AUTH_GOOGLE_ID      <from Google Cloud Console>
AUTH_GOOGLE_SECRET  <from Google Cloud Console>
```

- [ ] **Step 3: Update Railway build command**

In the app service settings, set the build command to:

```
npx prisma migrate deploy && next build
```

This runs DB migrations before every build, keeping the schema in sync.

- [ ] **Step 4: Set Google OAuth callback URL**

In Google Cloud Console → OAuth credentials → Authorized redirect URIs, add:

```
https://<your-railway-domain>/api/auth/callback/google
```

- [ ] **Step 5: Deploy and verify**

Push to main (or trigger a Railway deploy). Check the deploy logs for:
- `✔ Generated Prisma Client`
- `Migration applied` 
- Build success

Visit the deployed URL and verify: unauthenticated users are redirected to `/login`.
