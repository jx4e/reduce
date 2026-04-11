# Mobile Guide View — Design Spec
**Date:** 2026-04-09  
**Scope:** Guide view (`GuideView.tsx` + `GuideElement.tsx`) — mobile UX only  
**Approach:** Option A — all changes co-located in existing components

---

## Problem

On mobile, the Guide view is broken in three ways:

1. The TOC sidebar is `hidden md:flex` — no way to navigate sections.
2. The chat sidebar is `hidden md:flex` — no way to chat about the guide.
3. The "Ask" feature on each element is triggered by right-click — unusable on touch screens.

Desktop behaviour is untouched.

---

## Solution Overview

- Add a fixed bottom nav bar (mobile only) with three buttons: Contents | Guide | Chat.
- Contents and Chat open full-width bottom sheets that slide up over the guide content.
- Long-press (500ms) on any guide element opens the existing context menu at the touch position.

---

## Section 1: Bottom Nav Bar

**Where:** `GuideView.tsx`  
**Visibility:** `md:hidden` — mobile only

A fixed bar at the bottom of the viewport with three icon buttons:

| Position | Icon | Action |
|----------|------|--------|
| Left | List/hamburger | Opens TOC bottom sheet |
| Middle | Document/guide | Closes any open sheet (returns to guide) |
| Right | Chat bubble | Opens Chat bottom sheet |

**State:** New `mobileSheet: 'toc' | 'chat' | null` state variable. Replaces the need for separate boolean flags on mobile.

- Default state: `null` (guide content visible, no sheet open)
- Tapping Contents → `mobileSheet = 'toc'`
- Tapping Chat → `mobileSheet = 'chat'`
- Tapping Guide → `mobileSheet = null`
- The Guide button is visually "active" when `mobileSheet === null`

**Safe area:** Bar uses `padding-bottom: env(safe-area-inset-bottom)` to avoid being obscured by the iOS home indicator.

---

## Section 2: Bottom Sheets

**Where:** `GuideView.tsx`  
**Visibility:** `md:hidden`

Both sheets share the same structure:
- Fixed-position overlay, full width, ~75vh tall, slides up from bottom
- Visual drag handle at top (decorative only — no drag-to-dismiss)
- Semi-transparent backdrop behind the sheet; tapping backdrop closes the sheet (`mobileSheet = null`)
- Rendered with a CSS transition (`transform: translateY`) for the slide animation
- `×` close button in the sheet header also closes it

### TOC Sheet

Content: identical section list as the desktop sidebar.  
On section tap: scroll `scrollRef` to the target section via `document.getElementById(...).scrollIntoView()`, then set `mobileSheet = null`.

### Chat Sheet

Content: identical chat UI as the desktop sidebar — message list, input, send button.  
Reuses existing state: `guideMessages`, `chatInput`, `chatLoading`, `handleGuideChatSend`.  
Auto-focuses the input when `mobileSheet` changes to `'chat'`.

---

## Section 3: Long-press on GuideElement

**Where:** `GuideElement.tsx`  
**Trigger:** 500ms touch hold

Implementation (internal to `GuideElement`, no new props):

1. On `touchstart`: record touch coordinates, start a 500ms `setTimeout`.
2. On `touchend` or `touchmove` (before timeout fires): clear the timeout.
3. If timeout fires: call `setCtxMenu({ x: touch.clientX, y: touch.clientY })` — opens the existing context menu.

The existing `onContextMenu` (right-click) handler is preserved for desktop.

To prevent the browser's native long-press context menu from firing on mobile, add `onContextMenu={e => e.preventDefault()}` on touch devices (or unconditionally, since we already call `e.preventDefault()` in the handler).

---

## What is not changing

- Desktop layout (`md:flex` sidebars, drag-to-resize chat, right-click context menu) — untouched.
- Landing page, app page, login/register pages — out of scope.
- GuideElement modal UI — untouched.
- All API/data logic — untouched.
