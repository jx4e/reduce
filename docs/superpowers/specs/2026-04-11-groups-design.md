# Groups Feature Design
_Date: 2026-04-11_

## Overview

Groups are an optional organisational layer that sits above guides. A group holds a collection of saved source files and the guides generated from them. Future features (flashcards, quizzes) will also live inside a group and operate across its full set of source material.

The solo guide flow (`/app` → `/generate` → `/guide/[id]`) is untouched. Users who never use groups see no difference.

---

## Data Model

Three changes to the Prisma schema:

```prisma
model Project {
  id        String        @id @default(cuid())
  userId    String
  name      String
  createdAt DateTime      @default(now())
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  files     ProjectFile[]
  guides    Guide[]
}

model ProjectFile {
  id         String   @id @default(cuid())
  projectId  String
  name       String
  size       Int
  mimeType   String
  storageKey String
  uploadedAt DateTime @default(now())
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

// Guide gains an optional projectId FK
model Guide {
  // ...existing fields...
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
}
```

`storageKey` follows the pattern `projects/<projectId>/<uuid>-<originalFilename>`.

Solo guides have `projectId = null`. Deleting a project cascades to its files and sets `projectId` to null on its guides (guides are kept, not deleted).

---

## Storage Layer

**Service:** Tigris (S3-compatible), accessed via `@aws-sdk/client-s3`.  
**Endpoint:** `https://t3.storage.dev`  
**Credentials:** `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET_NAME` env vars.

A new `lib/storage.ts` exposes three functions:

```ts
uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void>
getPresignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>
deleteFile(key: string): Promise<void>
```

Files are uploaded server-side (Next.js route receives multipart FormData, streams to Tigris). This avoids presigned URL complexity at the cost of routing file bytes through the server — acceptable for files up to 10 MB.

During guide generation inside a group, stored files are fetched from Tigris by presigned URL and passed to `fileToContentBlock` in `lib/anthropic.ts` alongside any newly uploaded files.

---

## API Routes

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List current user's groups |
| `POST` | `/api/projects` | Create a group (`{ name }`) |
| `DELETE` | `/api/projects/[id]` | Delete group; cascades files in DB and storage |

### Project Files

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/projects/[id]/files` | Upload one or more files (multipart FormData) |
| `DELETE` | `/api/projects/[id]/files/[fileId]` | Remove a file from storage and DB |

### Guide Generation (extended)

`POST /api/guides/generate` gains two optional FormData fields:
- `projectId` — if set, the generated guide is linked to this group
- `storedFileIds` — comma-separated `ProjectFile` ids to include alongside any uploaded files

The route fetches stored files from Tigris (presigned URL → fetch → buffer) and merges them with any newly uploaded files before calling Claude. New files uploaded during a group generation are saved to the group automatically.

---

## Pages & Navigation

### Navbar
A "Groups" link is added next to the existing nav items. Active state follows the `/groups` prefix.

### `/groups`
- Lists the user's groups as cards: name, file count, guide count, creation date.
- "New Group" button — inline name input, submits to `POST /api/projects`.
- Empty state prompts creation.

### `/groups/[id]`
Two sections on one page:

**Files section**
- Grid/list of stored files: filename, size, upload date, delete button.
- "Add files" upload zone (same component as UploadZone, wired to `POST /api/projects/[id]/files`).

**Guides section**
- Cards for guides linked to this group (reuses `GuideCard`).
- "New Guide" button navigates to `/generate?projectId=[id]`.

### `/generate` (extended)
Reads an optional `projectId` query param. When present:
- Fetches the group's stored files and shows them as a checklist above the upload zone.
- User can tick stored files, upload new ones, or both.
- On submit, `setPending` is extended to carry `projectId` and `storedFileIds`.
- `POST /api/guides/generate` receives these and handles the rest.
- New uploaded files are saved to the group before generation begins.

The solo flow (no `projectId`) is identical to today.

---

## Error Handling

- Tigris upload failure: return 502, do not write `ProjectFile` row (no orphaned DB records).
- Stored file fetch failure during generation: surface as a generation error (same pattern as today).
- Project not found or not owned by current user: 404.
- File size and type validation reuses existing limits (5 files, 10 MB each) per upload request.

---

## Out of Scope

- Flashcards and quizzes (future feature, groups provide the foundation).
- Sharing groups between users.
- Renaming groups or files after creation.
- Pagination on file/guide lists (acceptable at current scale).
