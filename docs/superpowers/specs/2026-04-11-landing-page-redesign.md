# Landing Page Redesign — Spec

**Date:** 2026-04-11  
**Scope:** `app/page.tsx`, `app/globals.css` — visual layer only, no structural changes

---

## Goal

Remove the AI-slop visual patterns from the landing page and replace them with a warm editorial aesthetic. Same page structure, completely different feel.

---

## Palette

| Token | Current | New |
|---|---|---|
| `--background` | `#0a0a0a` | `#faf9f6` (warm cream) |
| `--surface` | `#111111` | `#f2f0ec` |
| `--border` | `#1f1f1f` | `#e0ddd8` |
| `--border-hover` | `#303030` | `#ccc8c0` |
| `--foreground` | `#f5f5f5` | `#1a1816` (warm near-black) |
| `--muted` | `#737373` | `#888070` (warm grey) |
| `--muted-dark` | `#404040` | `#b8b0a0` |
| `--accent` | `#6366f1` (indigo) | `#44403c` (warm stone) |

Light mode (`html.light`) is not in scope — leave those values as-is.

---

## Typography

Add **Playfair Display** (Google Fonts) to the project alongside Geist. Use it only for `h1` on the landing page and the CTA `h2`. All other text stays Geist sans.

```
import { Playfair_Display } from 'next/font/google'
```

Expose it as a CSS variable `--font-display` on `<html>` (same pattern as `--font-geist-sans`).

---

## Changes to `app/page.tsx`

### Hero section — remove

- The three blurred colour orb `<div>`s (the `aria-hidden` absolute-positioned background element)
- The dot grid overlay `<div>` (the `backgroundImage: radial-gradient` element)
- The pill badge `<span>` ("AI study guides" with glowing dot) — replace with a plain small-caps label: `<div className="hero-label">AI study guides</div>`
- The gradient `<span>` wrapping "get the tldr." — replace with plain text in an `<em>` so it italicises via Playfair Display
- The `boxShadow` glow on both CTA `<Link>` buttons

### Hero section — change

- `<h1>` font: add `style={{ fontFamily: 'var(--font-display)' }}` (or use a Tailwind utility if configured)
- Button style: solid `background: var(--accent)`, no shadow, `borderRadius: 3` instead of `rounded-full`

### Features section

- Remove the `position: absolute` top-edge accent line `<div>` from each feature card
- Change card `borderRadius` from `rounded-xl` to `rounded-md` (or `6px`)
- Lay the three cards out as a single bordered grid unit: wrap all three in a container with `border: 1px solid var(--border)` and `borderRadius: 6px`, use `gap: 0` between cards with a `1px` separator between them via CSS (see mockup)

### CTA section

- Change background from transparent (with radial gradient blob) to solid `var(--accent)` (`#44403c`)
- Change `<h2>` text colour to `#faf9f6`, font to `var(--font-display)`
- Change primary button to inverted: `background: #faf9f6`, `color: var(--accent)`, no shadow

---

## Changes to `app/globals.css`

Update all CSS variable values as listed in the Palette table above.

---

## What does NOT change

- Page structure (hero → demo → features → CTA → footer)
- `LandingDemo` component internals
- `LandingAnimations` (HeroItem / FadeUp)
- Navbar
- All non-landing pages
- Light mode palette

---

## Acceptance criteria

- No blurred orbs, dot grids, gradient text, or glowing buttons visible on the landing page
- Hero `h1` renders in Playfair Display
- CTA section has solid warm stone background
- Feature cards use the bordered grid treatment
- All other pages unaffected
