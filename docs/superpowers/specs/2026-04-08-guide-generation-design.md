# Guide Generation — Design Spec

**Date:** 2026-04-08
**Status:** Approved

---

## Overview

Users upload PDF and/or plaintext/markdown files on the home page, select a mode (Math/CS or Humanities), and click "Generate Guide." The app sends the files to a Next.js API route, which passes them directly to the Claude API as native document and text blocks. Claude returns a structured JSON guide. The client stores it in `localStorage` and redirects to the guide view.

No database or auth is wired in this phase. The `localStorage` layer is explicitly temporary — when Postgres is added later, only the read/write layer in the guide page changes.

---

## Data Flow

```
HomePage (files + mode)
  → FormData → POST /api/guides/generate
  → Server: PDFs encoded as base64 document blocks, txt/md as text blocks
  → Claude API (claude-sonnet-4-6): structured JSON prompt + file blocks
  → Response: Guide JSON
  → Client: localStorage.setItem(uuid, guide) → router.push(/guide/uuid)
  → /guide/[id]: reads from localStorage by ID → GuideView renders it
```

---

## API Route: POST /api/guides/generate

**Input:** `multipart/form-data`
- `files` — one or more files (PDF, `.txt`, `.md`)
- `mode` — `"math-cs"` or `"humanities"`

**Processing:**
1. Parse form data; reject with 400 if no files or unsupported type
2. For each file:
   - PDF → read as `ArrayBuffer`, encode as base64, build a `document` block
   - txt/md → read as UTF-8 text, build a `text` block
3. Build the Claude message: system prompt (mode-specific) + file blocks
4. Call `claude-sonnet-4-6`, parse JSON from response
5. Return the `Guide` JSON with a server-generated UUID as `id`

**Supported file types:** `application/pdf`, `text/plain`, `text/markdown`
**Unsupported types:** return 400 with a descriptive error message

**Error responses:**
- `400` — no files, unsupported file type
- `500` — Claude API failure or malformed JSON response

---

## Claude Prompt Design

### System prompt (shared)
Instructs Claude to return a single JSON object matching the `Guide` type. Includes:
- The full schema with all element types and their fields
- A short example showing one section with mixed element types
- Instruction to return **only** raw JSON (no markdown code fences, no prose)

### Mode-specific instructions
- **math-cs**: emphasise `formula` (LaTeX) and `code` elements; use `timeline` sparingly
- **humanities**: emphasise `paragraph` and `timeline` elements; include `formula` only if the source material contains equations

### Element types Claude may produce
| Type | Required fields | Notes |
|---|---|---|
| `heading` | `content`, `level` (2 or 3) | Section sub-headings only |
| `paragraph` | `content` | Plain explanatory text |
| `formula` | `content` | LaTeX string (KaTeX-renderable) |
| `code` | `content`, `language` | Fenced code block |
| `timeline` | `events` | Array of `{ date, title, description }` |

All elements also have `id` (UUID string assigned server-side after parsing — Claude does not generate IDs).

---

## localStorage Schema

```ts
// Key: guide UUID
// Value: serialised Guide JSON
localStorage.setItem(id, JSON.stringify(guide))
```

The `Guide` type is already defined in `types/guide.ts` — no changes needed.

---

## Components Changed

| File | Change |
|---|---|
| `lib/anthropic.ts` | New — Anthropic client singleton, prompt builder (mode-specific), file-to-message-block converter |
| `app/api/guides/generate/route.ts` | New — POST handler |
| `app/page.tsx` | `handleGenerate`: POST to API, save response to localStorage, redirect to `/guide/[id]` |
| `app/guide/[id]/page.tsx` | Read guide from localStorage by ID; pass to `GuideView` (replace mock) |
| `app/generate/page.tsx` | Show loading state while fetch is in-flight; show error state on failure with link back to home |

---

## Environment Variables

```env
ANTHROPIC_API_KEY=   # server-side only, never exposed to the client
```

---

## Out of Scope (this phase)

- Database persistence (Postgres / Drizzle)
- Auth (Auth.js)
- File storage (Cloudflare R2)
- Streaming generation
- DOCX / PPTX support
