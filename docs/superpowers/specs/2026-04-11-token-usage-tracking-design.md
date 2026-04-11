# Token Usage Tracking — Design Spec

**Date:** 2026-04-11  
**Status:** Approved

## Summary

Track each user's Claude API token consumption (input + output) and display lifetime totals with estimated dollar cost on the dashboard.

## Data Model

Add a `TokenUsage` table to the Prisma schema:

```prisma
model TokenUsage {
  id           String   @id @default(cuid())
  userId       String
  operation    String   // "generate" | "chat"
  inputTokens  Int
  outputTokens Int
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- One row per Claude API call
- `operation` is a plain string (not a DB enum) so new values can be added without a migration
- Indexed on `userId` for fast aggregate queries

## API Layer

### Recording usage

Both Claude-calling routes insert a `TokenUsage` row after a successful API call:

- `POST /api/guides/generate` — already has `session.user.id`; insert after `claudeStream.finalMessage()` succeeds
- `POST /api/guides/[id]/chat` — add auth check; insert after `claudeStream.finalMessage()` succeeds

If the session is missing on the chat route, skip the insert (do not fail the request). Tracking failures must never surface as errors to the user.

### Querying usage

New endpoint: `GET /api/usage`

- Requires auth; returns 401 if unauthenticated
- Queries: `SELECT SUM(inputTokens), SUM(outputTokens) FROM TokenUsage WHERE userId = ?`
- Computes `estimatedCostUsd` server-side:
  - Input: $3.00 per 1M tokens
  - Output: $15.00 per 1M tokens
  - Model: `claude-sonnet-4-6`
- Response shape:
  ```json
  {
    "totalTokens": 42000,
    "estimatedCostUsd": 0.0042
  }
  ```

## Dashboard Display

Extend the stats row from 2 to 4 cards:

| Guides | Groups | Tokens | Est. Cost |
|--------|--------|--------|-----------|
| 12 | 3 | 42,000 | $0.0042 |

- **Tokens**: `totalTokens` formatted with thousands separators
- **Est. Cost**: formatted as `$X.XXXX` (4 decimal places for low-usage precision)
- Both cards show `—` / `$0.00` if the fetch fails or returns zero
- `fetch('/api/usage')` added to the existing `Promise.all` in `DashboardPage`
- Grid changes from `grid-cols-2` to `grid-cols-4`; cards are not linked (no `href`)

## Future Extension

The `operation` column and per-row `createdAt` enable per-operation breakdowns (e.g. cost per guide, chat history) with no schema changes — just query changes.

## Files to Change

1. `prisma/schema.prisma` — add `TokenUsage` model and `User.tokenUsage` relation
2. `prisma/migrations/` — new migration
3. `app/api/guides/generate/route.ts` — insert `TokenUsage` row after generation
4. `app/api/guides/[id]/chat/route.ts` — add auth check; insert `TokenUsage` row after chat
5. `app/api/usage/route.ts` — new file, aggregate query + cost calculation
6. `app/dashboard/page.tsx` — fetch usage, expand stats grid to 4 cards
