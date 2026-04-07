# Architecture Plan — reduce

## Context

reduce needs user accounts so guides are saved server-side and accessible from any device. This rules out the original BYOK/IndexedDB-only approach and requires a proper backend with auth, a database, and file storage.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Full-stack in one repo, API routes built in, large ecosystem |
| Styling | Tailwind CSS v4 | Utility-first, fast to build with |
| Math rendering | KaTeX | Best-in-class LaTeX rendering in the browser |
| AI | Anthropic JS SDK | Called server-side from API routes |
| Auth | Auth.js (NextAuth v5) | Runs inside Next.js, supports credentials + OAuth providers |
| Database | Postgres | Relational, hosted on Railway |
| ORM | Drizzle ORM | Lightweight, TypeScript-native, works well with Postgres |
| File storage | Cloudflare R2 | S3-compatible, cheap egress, good for user-uploaded PDFs |
| Deployment | Railway | Hosts the Next.js app + Postgres in one project |

---

## Data Model (high level)

```
User
  id, email, name, passwordHash, createdAt

Guide
  id, userId (FK), title, mode, createdAt, updatedAt

GuideSource                        ← uploaded files attached to a guide
  id, guideId (FK), fileName, r2Key, mimeType, uploadedAt

GuideSection                       ← generated content, stored as structured JSON
  id, guideId (FK), order, heading, elements (JSON)

ChatMessage
  id, guideId (FK), userId (FK), role, content, contextElementId, createdAt
```

---

## API Routes

```
POST   /api/auth/[...nextauth]     — Auth.js handler (login, signup, session)

POST   /api/guides                 — create a new guide (upload files, kick off generation)
GET    /api/guides                 — list guides for current user
GET    /api/guides/[id]            — fetch a single guide with sections
DELETE /api/guides/[id]            — delete a guide

POST   /api/guides/[id]/chat       — send a chat message, stream AI response back
GET    /api/guides/[id]/chat       — fetch chat history for a guide

POST   /api/upload                 — get a presigned R2 URL for file upload
```

---

## Auth Flow

1. User signs up with email + password (hashed with bcrypt, stored in Postgres)
2. Auth.js manages the session (JWT or database sessions)
3. All API routes check `auth()` from Auth.js — unauthenticated requests get 401
4. OAuth providers (Google, GitHub) can be added later with minimal changes

---

## File Upload Flow

1. Client requests a presigned upload URL from `/api/upload`
2. Client uploads the file directly to R2 (no file data passes through the Next.js server)
3. R2 key is stored in `GuideSource` table
4. When generating a guide, the server fetches the file from R2, extracts text, sends to Claude

---

## AI Generation Flow

1. User submits upload + mode selection
2. `/api/guides` creates a `Guide` record, fetches files from R2, extracts text
3. Streams a structured prompt to Claude (claude-sonnet-4-6)
4. Response is parsed into `GuideSection` records and saved to Postgres
5. Client is redirected to `/guide/[id]` — sections load from DB

---

## Environment Variables

```env
# Auth
AUTH_SECRET=                        # random secret for Auth.js JWT signing

# Database
DATABASE_URL=                       # Railway Postgres connection string

# Anthropic
ANTHROPIC_API_KEY=                  # server-side only, never exposed to client

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=                      # public bucket URL for serving files (optional)
```

---

## File Structure

```
app/
  layout.tsx                        — root layout
  page.tsx                          — Home / Upload (redirects to /dashboard if authed)
  (auth)/
    login/page.tsx                  — login page
    signup/page.tsx                 — signup page
  dashboard/
    page.tsx                        — user's guide library
  generate/
    page.tsx                        — generation stepper (polls guide status)
  guide/
    [id]/
      page.tsx                      — study guide view

  api/
    auth/[...nextauth]/route.ts     — Auth.js handler
    guides/
      route.ts                      — GET list, POST create
      [id]/
        route.ts                    — GET, DELETE
        chat/route.ts               — GET history, POST message (streaming)
    upload/route.ts                 — presigned R2 URL

components/
  Navbar.tsx
  GuideCard.tsx
  GuideElement.tsx
  AskBar.tsx
  Stepper.tsx

lib/
  auth.ts                           — Auth.js config
  db/
    index.ts                        — Drizzle client
    schema.ts                       — table definitions
  r2.ts                             — R2 client + helpers
  anthropic.ts                      — Anthropic client + prompt helpers
```
