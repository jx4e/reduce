<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## React 19

`useRef<T>(null)` returns `RefObject<T | null>`, not `RefObject<T>`. Type hook return interfaces accordingly.

## Testing

Run tests with: `npx jest --no-coverage`

jsdom doesn't apply CSS media queries — don't rely on Tailwind responsive classes (e.g. `hidden md:flex`) to hide elements in tests.

ESM packages that break Jest need a mock in `__mocks__/` and an entry in `jest.config.ts` under `moduleNameMapper`.

## Architecture

- `lib/` — shared utilities, no React imports
- `hooks/` — custom React hooks
- `components/elements/` — one file per element type; use `renderElement()` from the index, don't import element components directly
- `components/guide/` — composed guide UI (GuideTOC, GuideContent, GuideChatPanel)
- Chat streaming is handled by `streamChat` in `lib/chat.ts` — don't re-implement SSE inline

## Avoiding merge conflicts

Keep changes scoped to the files your task specifies. Don't refactor, reformat, or "improve" adjacent code you weren't asked to touch — that's the most common source of merge conflicts when multiple agents work in parallel.

If you need to add shared logic, put it in a new file in `lib/` or `hooks/` rather than modifying an existing one.
