# Landing Page Design — tldr.

## Overview

Add a marketing landing page at `/` for unauthenticated visitors. Authenticated users hitting `/` are redirected to `/app`. The current home dashboard (upload zone + recent guides) moves to `/app`.

## Route Changes

| Route | Before | After |
|-------|--------|-------|
| `/` | Authenticated dashboard (upload + guides) | Landing page (unauthenticated) |
| `/app` | — | Authenticated dashboard (moved from `/`) |

`app/page.tsx` becomes the landing page server component. It checks the session via `auth()` and redirects logged-in users to `/app`. The existing `app/page.tsx` content moves to `app/app/page.tsx` unchanged.

## Page Structure (scroll narrative)

### 1. Hero

- Eyebrow label: `AI study guides` (indigo, uppercase)
- Headline: `upload your notes. / get the tldr.` — "get the tldr." in indigo
- Subtext: one sentence describing the product
- Primary CTA: `Start studying free →` → `/register`
- Secondary link: `See how it works ↓`
- Trust line: `No credit card. Works with PDFs, slides, and plain text.`

### 2. Demo

- Section label: `See it in action`
- Heading: `From notes to guide in seconds.`
- Subtext: `Here's a sample guide — click any section to expand it.`
- Widget: `LandingDemo` component (see below)

### 3. Features

- Section label: `How it works`
- Heading: `Three steps to a better study session.`
- Three cards: Upload your material / Get a structured guide / Ask about anything

### 4. CTA Footer

- Heading: `ready to study smarter?`
- Subtext: `Free to get started. No credit card required.`
- Primary CTA: `Create your first guide →` → `/register`
- Secondary link: `Sign in` → `/login`

## LandingDemo Component

**File:** `components/LandingDemo.tsx` (`'use client'`)

Renders real `GuideElement` components with hardcoded sample data (Binary Search Trees, ~4 elements: heading, paragraph, code block, formula). Manages per-element chat state identically to `GuideView`.

**Scripted `onAsk` handler:** When the user submits a question in the chat modal, a pre-written response is typed out character-by-character at ~20ms/char to simulate streaming. The scripted reply is keyed to element id — each element has one canned response that works for any question (e.g. "Great question. In a BST, the key invariant is…"). This makes the demo feel live without hitting any API.

**Sample content elements:**
- `heading` (h2): "Binary Search Trees"
- `paragraph`: definition of a BST
- `code` (python): simple BST search implementation
- `formula`: O(log n) complexity expressed in LaTeX

## Styling

Follows existing CSS variables (`--background`, `--foreground`, `--accent`, `--border`, `--muted`, `--surface`). Dark by default, consistent with the rest of the app. No new CSS variables introduced.

## Files Changed

| File | Change |
|------|--------|
| `app/page.tsx` | Replace with landing page server component |
| `app/app/page.tsx` | New file — current `app/page.tsx` content moved here |
| `components/LandingDemo.tsx` | New component — interactive demo widget |

## Out of Scope

- README, plan docs, or any other historical documents
- Animations or scroll effects beyond what CSS variables already support
- Any changes to auth, API routes, or existing guide pages
