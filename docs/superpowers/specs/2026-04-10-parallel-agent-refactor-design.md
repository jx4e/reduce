# Parallel Agent Refactor Design

**Date:** 2026-04-10
**Goal:** Split large monolithic components into focused files with clear contracts, enabling parallel Claude agents to work without merge conflicts.

## Problem

Two files dominate the codebase and are touched by almost every feature:

- `GuideView.tsx` (640 lines) — chat, layout, TOC, scroll detection, resize, mobile, modals
- `GuideElement.tsx` (478 lines) — all element types, per-element chat, notes, markdown, math

Any two agents working on unrelated features will conflict if both touch these files. The fix is to split them along natural seams and define explicit contracts (TypeScript interfaces) at the boundaries so agents can build against them without reading each other's code.

## Approach

**B: Components + hooks extraction**

Extract logic into custom hooks, split UI into focused components. Logic and UI are cleanly separated. An agent working on chat behaviour touches the hook; an agent working on chat UI touches the component. No overlap.

## File Structure

```
hooks/
  useGuideChat.ts       ← main guide chat: messages, streaming, input state
  useElementChat.ts     ← per-element chat (click an element to ask about it)
  useGuideScroll.ts     ← active section detection based on scroll position
  useResizable.ts       ← drag-to-resize panel logic

components/guide/
  GuideTOC.tsx          ← table of contents sidebar
  GuideChatPanel.tsx    ← chat UI (input box, message list)
  GuideContent.tsx      ← renders the list of guide elements

components/elements/
  HeadingElement.tsx
  ParagraphElement.tsx
  FormulaElement.tsx
  CodeElement.tsx
  ImageElement.tsx
  TimelineElement.tsx
  MarkdownContent.tsx   ← shared markdown renderer
  index.ts              ← exports map of type → component

app/guide/[id]/
  GuideView.tsx         ← shrinks to ~100 lines, composes the above
```

`GuideElement.tsx` stays but shrinks — it looks up the right component from `elements/index.ts` and renders it.

## Contracts

### Hooks

```typescript
// hooks/useGuideChat.ts
interface UseGuideChatReturn {
  messages: ChatMessage[]
  loading: boolean
  input: string
  setInput: (value: string) => void
  send: (question: string) => void
}

// hooks/useElementChat.ts
interface UseElementChatReturn {
  messages: ChatMessage[]
  loading: boolean
  send: (question: string, element: ContentElement) => void
}

// hooks/useGuideScroll.ts
interface UseGuideScrollReturn {
  activeSection: string | null
  contentRef: React.RefObject<HTMLDivElement>
  scrollToSection: (id: string) => void
}

// hooks/useResizable.ts
interface UseResizableReturn {
  width: number
  handleMouseDown: (e: React.MouseEvent) => void
}
```

### Components

```typescript
// components/guide/GuideTOC.tsx
interface GuideTOCProps {
  sections: GuideSection[]
  activeSection: string | null
  onSectionClick: (id: string) => void
}

// components/guide/GuideChatPanel.tsx
interface GuideChatPanelProps {
  guideId: string
  mode: GuideMode
}
// manages its own state internally via useGuideChat

// components/guide/GuideContent.tsx
interface GuideContentProps {
  sections: GuideSection[]
  guideId: string
  contentRef: React.RefObject<HTMLDivElement>
}

// components/elements/* (all element components share this shape)
interface ElementProps {
  element: ContentElement
  guideId: string
}
```

### GuideView after refactor

```typescript
export function GuideView({ guide }: { guide: Guide }) {
  const { activeSection, contentRef, scrollToSection } = useGuideScroll()
  const { width, handleMouseDown } = useResizable()

  return (
    <div className="flex h-screen">
      <GuideTOC
        sections={guide.sections}
        activeSection={activeSection}
        onSectionClick={scrollToSection}
      />
      <GuideContent
        sections={guide.sections}
        guideId={guide.id}
        contentRef={contentRef}
      />
      <ResizeHandle onMouseDown={handleMouseDown} />
      <GuideChatPanel
        guideId={guide.id}
        mode={guide.mode}
      />
    </div>
  )
}
```

## Mobile Layout

Mobile layout (bottom sheet for chat, hidden TOC) is handled within individual components — not in `GuideView`. `GuideChatPanel` renders a bottom sheet on mobile and a side panel on desktop. `GuideTOC` handles its own visibility. `GuideView` stays layout-agnostic.

## Key Design Decisions

- **`GuideChatPanel` owns its own state** via `useGuideChat` internally. It does not receive messages as props. This means an agent working on chat never needs to touch `GuideView`.
- **Element components share a single `ElementProps` interface.** Adding a new element type means adding a new file in `components/elements/` and registering it in `index.ts` — no changes to `GuideElement.tsx` or `GuideView.tsx`.
- **Hooks are pure logic.** They return data and callbacks. They don't render anything. This makes them easy to test in isolation.

## Out of Scope

- LLM provider abstraction (Anthropic SDK)
- File validation pipeline
- API route restructuring

These are good ideas but don't materially reduce merge conflict risk. Revisit when there's a specific need.

## Success Criteria

- `GuideView.tsx` is under 150 lines
- `GuideElement.tsx` is under 100 lines
- No single file handles more than one concern
- Two agents can work on different features without touching the same file
- TypeScript build passes with no errors
- UI behaviour is unchanged
