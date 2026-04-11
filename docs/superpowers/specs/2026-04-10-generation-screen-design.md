# Generation Screen Improvements

**Date:** 2026-04-10  
**Status:** Approved

## Overview

Replace the current numbered stepper on the `/generate` page with a progress bar + stage copy layout that feels alive, communicates what's happening at each stage, completes the Rendering step visibly before navigating, and provides a useful error state with retry.

## Visual Design

The stepper (`Stepper` component) is removed. The loading screen shows three elements stacked vertically, centered:

1. **Stage title** — medium weight, foreground color (e.g. "Analyzing your material…")
2. **Stage description** — small, muted color (e.g. "Breaking down structure and key concepts")
3. **Progress bar** — full width, capped at `max-w-sm`, 3px tall, gradient fill (`--accent` → lighter purple), on a muted track. Rounded ends.
4. **Stage counter** — small muted label below the bar: "Stage 2 of 4"

## Stage Copy

| Stage | Title | Description |
|---|---|---|
| Parsing | Reading your files… | Extracting text and structure from your uploads |
| Analyzing | Analyzing your material… | Breaking down structure and key concepts |
| Writing | Writing your guide… | Generating sections, examples, and explanations |
| Rendering | Finishing up… | Assembling the final guide |

## Progress Mechanic

Each stage owns a progress band. The bar animates from the band's start toward its ceiling using a CSS ease-out curve — it decelerates and never quite reaches the ceiling until the next stage fires.

| Stage | Band |
|---|---|
| Parsing | 0–20% |
| Analyzing | 20–50% |
| Writing | 50–85% |
| Rendering | 85–100% |

On `done`:
1. Bar snaps to 100% instantly
2. Stage title changes to "Done!" (or similar)
3. Hold for ~600ms
4. Navigate to the guide page

This ensures the Rendering stage is always visibly shown and completes before the user is taken away.

Implementation: use a CSS custom property `--progress` on the bar element, updated via inline style. The CSS transition applies `ease-out` with a duration long enough to decelerate before the next stage fires. A `useEffect` on `currentStage` sets the target value for each band.

## Error State

Replace the bare text layout with:

- **Heading:** "Generation failed" (small, semibold, foreground)
- **Message:** error text (small, muted, `max-w-sm`, centered)
- **Actions row:**
  - **Retry** button (accent, rounded-full) — re-runs generation with the same files
  - **← Start over** link — navigates back to `/app`

**Retry behaviour:** `consumePending()` currently clears the pending data on read. Change it so the data is only cleared on success (`router.push` to the guide) or when the user explicitly navigates away via "Start over". On retry, the page re-runs the same generation flow using the still-in-memory pending data.

## Files Affected

- `app/generate/page.tsx` — main changes (replace stepper, add progress bar, new error state, retry logic)
- `lib/pendingGeneration.ts` — change clear-on-read to clear-on-success
- `components/Stepper.tsx` — no changes (component remains, just not used on generate page)

## Out of Scope

- Real token-based progress (eased fake progress is sufficient)
- Changes to the generate API route
- Changes to any other page
