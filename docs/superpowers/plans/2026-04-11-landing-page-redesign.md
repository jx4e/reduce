# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove AI-slop visual patterns (orbs, gradient text, dot grid, glowing buttons) from the landing page and replace them with a warm editorial aesthetic.

**Architecture:** Purely visual changes — same page structure (hero → demo → features → CTA → footer), same components. Changes are limited to CSS variables in `globals.css`, font import in `layout.tsx`, and inline style edits in `app/page.tsx`. No logic, no new components, no new files (except font variable).

**Tech Stack:** Next.js (App Router), Tailwind CSS v4, Framer Motion, `next/font/google`

---

## File Map

| File | Change |
|---|---|
| `app/globals.css` | Update dark-mode CSS variable values + expose `--font-display` in `@theme` |
| `app/layout.tsx` | Import `Playfair_Display`, add its CSS variable to `<html>` |
| `app/page.tsx` | Hero: remove orbs/dot-grid/pill-badge/gradient-text/button-glow, serif h1. Features: remove accent lines, bordered grid. CTA: solid stone bg, serif h2, inverted button. |

---

## Task 1: Update CSS variables

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the `:root` block and `@theme inline` block**

Replace the existing `:root` block (lines 3–12) and `@theme inline` block (lines 25–30) with:

```css
:root {
  --background: #faf9f6;
  --foreground: #1a1816;
  --surface: #f2f0ec;
  --border: #e0ddd8;
  --border-hover: #ccc8c0;
  --muted: #888070;
  --muted-dark: #b8b0a0;
  --accent: #44403c;
}

html.light {
  --background: #ffffff;
  --foreground: #111111;
  --surface: #f5f5f5;
  --border: #e5e5e5;
  --border-hover: #d4d4d4;
  --muted: #737373;
  --muted-dark: #a3a3a3;
  --accent: #6366f1;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-display: var(--font-playfair);
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
npx jest --no-coverage LandingPage LandingDemo
```

Expected: `Tests: 9 passed`

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: switch to warm editorial colour palette"
```

---

## Task 2: Add Playfair Display font

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the Playfair_Display import and instantiation**

Replace the existing font block (lines 3–11 of `app/layout.tsx`):

```ts
import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
})
```

- [ ] **Step 2: Add the variable to `<html>`**

In the `RootLayout` return, change the `className` on `<html>` from:

```tsx
className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
```

to:

```tsx
className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}
```

- [ ] **Step 3: Run tests**

```bash
npx jest --no-coverage LandingPage LandingDemo
```

Expected: `Tests: 9 passed`

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "style: add Playfair Display font variable"
```

---

## Task 3: Rework the hero section

**Files:**
- Modify: `app/page.tsx`

The current hero section (lines 15–73) has: colour orbs, dot grid, a pill badge, a gradient `<span>` on the headline, and glowing buttons. All of these get removed or simplified.

- [ ] **Step 1: Replace the hero section**

Replace everything from `{/* ── Hero ──` through the closing `</section>` of the hero (lines 14–73) with:

```tsx
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20" style={{ borderBottom: '1px solid var(--border)' }}>

        <HeroItem delay={0}>
          <div
            className="text-xs font-semibold tracking-widest uppercase mb-8"
            style={{ color: 'var(--muted)' }}
          >
            AI study guides
          </div>
        </HeroItem>

        <HeroItem delay={0.1}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 7vw, 76px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '1.25rem', maxWidth: '680px' }}>
            upload your notes.<br />
            <em>get the tldr.</em>
          </h1>
        </HeroItem>

        <HeroItem delay={0.2}>
          <p style={{ fontSize: 17, color: 'var(--muted)', maxWidth: 400, lineHeight: 1.65, marginBottom: '2.25rem' }}>
            Drop in your lecture notes, slides, or PDFs — get a structured,
            interactive study guide back in seconds.
          </p>
        </HeroItem>

        <HeroItem delay={0.3}>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link
              href="/register"
              className="px-6 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--background)', borderRadius: 3 }}
            >
              Start studying free →
            </Link>
            <a href="#demo" className="text-sm" style={{ color: 'var(--muted)' }}>
              See how it works ↓
            </a>
          </div>
        </HeroItem>

        <HeroItem delay={0.4}>
          <p className="mt-5 text-xs" style={{ color: 'var(--muted-dark)' }}>
            No credit card. Works with PDFs, slides, and plain text.
          </p>
        </HeroItem>
      </section>
```

- [ ] **Step 2: Run tests**

```bash
npx jest --no-coverage LandingPage LandingDemo
```

Expected: `Tests: 9 passed`

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "style: remove hero decoration (orbs, dot grid, gradient text, pill badge)"
```

---

## Task 4: Rework the features section

**Files:**
- Modify: `app/page.tsx`

The current features section has floating rounded cards with a per-card top-edge accent line. Replace with a single bordered grid where the 1 px gaps between cards serve as dividers.

- [ ] **Step 1: Replace the features grid**

Find and replace the `<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">` block (the map + all three cards inside it) with:

```tsx
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {[
              {
                num: '01',
                title: 'Upload your material',
                body: 'PDFs, slides, lecture notes, or plain text. Any format, any subject.',
              },
              {
                num: '02',
                title: 'Get a structured guide',
                body: 'AI breaks it into sections with explanations, formulas, code blocks, and timelines.',
              },
              {
                num: '03',
                title: 'Ask about anything',
                body: 'Right-click any section and ask questions. The AI explains using your own material.',
              },
            ].map(({ num, title, body }, i) => (
              <FadeUp
                key={title}
                delay={i * 0.1}
                style={{ background: 'var(--background)', padding: '24px 20px' }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted-dark)', marginBottom: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  {num}
                </div>
                <div className="text-sm font-bold mb-2">{title}</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</div>
              </FadeUp>
            ))}
          </div>
```

- [ ] **Step 2: Run tests**

```bash
npx jest --no-coverage LandingPage LandingDemo
```

Expected: `Tests: 9 passed`

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "style: replace feature cards with bordered grid treatment"
```

---

## Task 5: Rework the CTA section

**Files:**
- Modify: `app/page.tsx`

The current CTA section has a radial gradient blob background and a glowing button. Replace with a solid warm stone background and an inverted (light-on-dark) button.

- [ ] **Step 1: Replace the CTA section**

Replace everything from `{/* ── CTA ──` through the closing `</section>` of the CTA (the section with `position: 'relative', padding: '88px 24px'`) with:

```tsx
      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--accent)', padding: '88px 24px', textAlign: 'center' }}>
        <FadeUp>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--background)' }}>
            ready to study smarter?
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--muted-dark)' }}>
            Free to get started. No credit card required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="px-7 py-3 text-sm font-semibold"
              style={{ background: 'var(--background)', color: 'var(--accent)', borderRadius: 3 }}
            >
              Create your first guide →
            </Link>
            <Link href="/login" className="text-sm" style={{ color: 'var(--muted-dark)' }}>
              Sign in
            </Link>
          </div>
        </FadeUp>
      </section>
```

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "style: CTA section solid stone background, inverted button, serif headline"
```

---

## Task 6: Smoke check in the browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify these things are gone on the landing page**
  - No purple/cyan blurred orbs behind the hero
  - No dot grid overlay
  - No glowing button shadows
  - No gradient text on "get the tldr."
  - No indigo anywhere

- [ ] **Step 3: Verify these things are present**
  - Hero h1 renders in Playfair Display (serif, italic on "get the tldr.")
  - Warm cream background across all landing sections
  - CTA section has solid warm stone background with light text
  - Feature cards sit in a single bordered grid unit
  - All other pages (app, guide, login, register) look unaffected
