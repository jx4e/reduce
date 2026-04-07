# UI Layout Plan — reduce

## Context
The project is a blank slate (only a README exists). This plan defines the UI layout for all screens before any implementation begins. The goal is to agree on screen structure, navigation flow, and key interactions upfront.

---

## Screens

### 1. Home / Upload (`/`)

```
┌─────────────────────────────────────────────┐
│  reduce                        [API Key ⚙]  │  ← sticky top nav
├─────────────────────────────────────────────┤
│                                             │
│           Upload your material              │
│                                             │
│     ┌───────────────────────────────┐       │
│     │  ⬆ Drag & drop or click       │       │
│     │  PDF, slides, notes           │       │
│     │  (multiple files supported)   │       │
│     └───────────────────────────────┘       │
│                                             │
│     Mode:  [Math / CS ●]  [Humanities ○]   │
│                                             │
│              [Generate Guide →]             │
│                                             │
│  ─────────── Recent Guides ───────────      │
│                                             │
│  [Card: Guide 1]  [Card: Guide 2]  [+]     │  ← from IndexedDB
│                                             │
└─────────────────────────────────────────────┘
```

**Notes:**
- Nav shows user avatar/account menu when logged in, or sign in link when logged out
- Mode toggle visible before generation (affects prompt style)
- Multiple files can be uploaded and combined into one guide
- Recent guides shown as cards (title, date, mode badge), sourced from server (Postgres)

---

### 2. Generation Loading (`/generate` or overlay)

A **stepper progress indicator** shown as the guide is being generated:

```
  ●  ─────  ○  ─────  ○  ─────  ○
Parsing   Analyzing  Writing  Rendering
```

- Circles fill/animate as each stage completes
- Dashes between stages animate as connectors
- Current stage label shown beneath the active circle
- Navigates automatically to the guide view when complete

---

### 3. Study Guide View (`/guide/[id]`)

```
┌──────────────────────────────────────────────────────┐
│  reduce  /  Guide Title                [← Home]      │  ← nav
├──────────────────────────────────────────────────────┤
│  TOC sidebar (sticky) │  Content (scrollable)        │
│  ──────────────────   │  ────────────────────────    │
│  1. Introduction      │                              │
│  2. Key Concepts      │  ## Section 1                │← hover shows ask icon
│  3. Formulas          │                              │
│  4. Worked Examples   │  Explanation text...         │← hover shows ask icon
│  5. Common Pitfalls   │                              │
│                       │  $$ \nabla \cdot E = ... $$  │← hover shows ask icon
│                       │                              │
│                       │  ```python                   │← hover shows ask icon
│                       │  def example(): ...          │
│                       │  ```                         │
├───────────────────────┴──────────────────────────────┤
│  Ask anything about this guide...              [→]   │  ← always-visible ask bar
└──────────────────────────────────────────────────────┘
```

#### Clickable Element Interaction

Every rendered element (heading, paragraph, formula, code block) is clickable:

1. User **hovers** → a small "Ask ?" icon appears beside the element
2. User **clicks** → a bubble/popover appears near the element:
   ```
   ┌─────────────────────────────────────────┐
   │  Ask about: "$$ \nabla \cdot E = ... $$" │
   │  ┌───────────────────────────────────┐   │
   │  │  What does this formula mean?     │   │
   │  └───────────────────────────────────┘   │
   │                              [Ask →]     │
   └─────────────────────────────────────────┘
   ```
3. Submitting the question **pre-fills the bottom ask bar** with the element as context and opens the chat drawer above the bar to show the answer

#### Bottom Ask Bar + Chat Drawer

- The ask bar is always visible at the bottom of the page
- Sending a message (general or contextual) expands the bar upward into a **chat drawer** showing the conversation history
- The drawer can be collapsed back to the single-line ask bar
- Contextual questions include a small tag showing which element they were about

---

## Navigation Flow

```
[Home] → upload doc(s) → click Generate
         → [Generation Stepper] (stages animate)
         → [Guide View] (auto-redirect on complete)

[Home] → click recent guide card → [Guide View]

[Guide View] → click ← Home → [Home]
```

---

## Stack

See `plans/architecture.md` for the full stack and infrastructure decisions.

---

## File Structure

```
app/
  layout.tsx              — root layout, fonts, metadata
  page.tsx                — Home / Upload
  generate/
    page.tsx              — Generation stepper
  guide/
    [id]/
      page.tsx            — Study Guide View

components/
  Navbar.tsx              — sticky top nav with API key modal
  GuideCard.tsx           — recent guide card (used on Home)
  GuideElement.tsx        — single content block with hover ask + popover
  AskBar.tsx              — bottom ask bar + expandable chat drawer
  Stepper.tsx             — animated stage progress indicator
```

---

## Summary of Key Decisions

| Decision | Choice |
|---|---|
| Guide layout | Full-width content + sticky TOC sidebar + bottom ask bar |
| Chat interaction | Bottom ask bar expands into chat drawer |
| Element interaction | Hover to reveal ask icon → click to open contextual popover |
| Contextual question flow | Popover submit pre-fills ask bar with element context |
| Generation UX | Animated stepper: Parsing → Analyzing → Writing → Rendering |
| Multi-upload | Yes — multiple files combined per guide |
| Auth | Nav shows account menu (logged in) or sign in link (logged out) |
| Data persistence | Server-side — Postgres via API routes |
