---
feature: Phase 1 — Database Schema
description: >
  Define the core database schema (memories, memory_embeddings, tasks, ingestion_log)
  using Drizzle ORM with pgvector and tsvector support. Create shared types in
  packages/types, generate the first migration (with pgvector extension), and update
  the DB client to pass schema for type-safe queries. This completes the Phase 1
  milestone: `npm run db:migrate` works against a running Postgres+pgvector instance.
labels:
  - phase-1
  - database
---

## Work Items

### L0: shared-types — Define shared type aliases in packages/types

**Branch:** `feat/phase-1-shared-types`
**Files:**

- `packages/types/memory.ts` (new)
- `packages/types/task.ts` (new)
- `packages/types/ingestion-log.ts` (new)
- `packages/types/index.ts` (modify — add re-exports)

**Description:**
Define the core domain types that will be used across both packages. These are plain
TypeScript type aliases (not Drizzle-coupled) representing the application-level shapes.
They will be inferred from the Drizzle schema once it exists, but we define them here
first as the contract that other code programs against. Includes: `Memory`,
`NewMemory`, `Task`, `NewTask`, `TaskStatus`, `TaskPriority`, `IngestionLogEntry`,
`NewIngestionLogEntry`, and the `Db` type alias wrapping the Drizzle instance.

**Acceptance Criteria:**

- [ ] `Memory` type has id, content, category, source, tags, metadata, sourceDate, createdAt, updatedAt, deletedAt fields
- [ ] `Task` type has id, title, description, status (pending/done/snoozed/cancelled), priority (1-3), dueDate, reminderAt, snoozedUntil, completedAt, sourceMemoryId
- [ ] `IngestionLogEntry` type has id, source, externalId, dedupHash, memoryId
- [ ] `New*` types omit auto-generated fields (id, createdAt, etc.)
- [ ] `Db` type alias exported for dependency injection
- [ ] `packages/types/index.ts` barrel re-exports all types
- [ ] `npm run typecheck` passes

---

### L0: db-schema — Define Drizzle schema with pgvector and tsvector

**Branch:** `feat/phase-1-db-schema`
**Files:**

- `packages/server/src/db/schema.ts` (modify — replace empty placeholder)
- `packages/server/src/db/schema.test.ts` (new)

**Description:**
Implement the full database schema in Drizzle ORM: `memories` table with a generated
`tsvector` column for full-text search, `memory_embeddings` table with `vector(768)` for
pgvector cosine similarity, `tasks` table for extracted tasks, and `ingestion_log` table
for deduplication. Use Drizzle's native pgvector support (`vector` column type) and
`customType` for the `tsvector` generated column. Add GIN indexes on the tsvector and
tags columns. Do NOT add an HNSW vector index — that comes after bulk imports in
Phase 7.5.

Tests verify the schema exports the correct table definitions and column types
(structural tests, no DB connection needed).

**Acceptance Criteria:**

- [ ] `memories` table: id (uuid, pk, default random), content (text, not null), search (tsvector, generated always as `to_tsvector('english', content)`), category (text), source (text, not null), tags (text array), metadata (jsonb), sourceDate (timestamptz), createdAt (timestamptz, default now), updatedAt (timestamptz, default now), deletedAt (timestamptz, nullable)
- [ ] `memory_embeddings` table: id (uuid, pk), memoryId (uuid, fk → memories, not null), model (text, not null), embedding (vector(768), not null), createdAt (timestamptz, default now). Unique constraint on (memoryId, model)
- [ ] `tasks` table: id (uuid, pk), title (text, not null), description (text), status (text, not null, default 'pending'), priority (integer, default 2), dueDate (timestamptz), reminderAt (timestamptz), snoozedUntil (timestamptz), completedAt (timestamptz), sourceMemoryId (uuid, fk → memories), createdAt (timestamptz, default now), updatedAt (timestamptz, default now)
- [ ] `ingestion_log` table: id (uuid, pk), source (text, not null), externalId (text), dedupHash (text, not null), memoryId (uuid, fk → memories, not null), createdAt (timestamptz, default now). Unique index on (source, externalId)
- [ ] GIN index on `memories.search` (tsvector)
- [ ] GIN index on `memories.tags`
- [ ] All tables and relations exported from schema.ts
- [ ] Schema test file verifies table names and column existence
- [ ] `npm run typecheck` passes

---

### L1: db-client-schema — Wire schema into DB client and export Db type

**Depends on:** db-schema
**Branch:** `feat/phase-1-db-client-schema`
**Files:**

- `packages/server/src/db/client.ts` (modify — pass schema to drizzle())
- `packages/server/src/db/client.test.ts` (new)

**Description:**
Update `createDb()` to pass the schema object to `drizzle()` so that queries get
full type inference. Export a `Db` type from the client module (using
`ReturnType<typeof createDb>`) that other services will use for dependency injection.
Update `packages/types/` if the `Db` type should come from server instead.

Tests mock the `postgres` driver and verify `createDb()` returns a Drizzle instance
with the schema attached.

**Acceptance Criteria:**

- [ ] `createDb()` passes `{ schema }` to `drizzle()` for type-safe queries
- [ ] `Db` type exported from client.ts as `type Db = ReturnType<typeof createDb>`
- [ ] Test verifies `createDb` can be called (with mocked postgres)
- [ ] `npm run typecheck` passes

---

### L1: first-migration — Generate and patch the initial migration

**Depends on:** db-schema
**Branch:** `feat/phase-1-first-migration`
**Files:**

- `packages/server/src/db/migrations/` (new — generated SQL files)

**Description:**
Run `npm run db:generate` to produce the initial migration from the Drizzle schema.
Then manually prepend `CREATE EXTENSION IF NOT EXISTS vector;` to the generated SQL
file (pgvector extension must exist before vector columns are created). Verify the
migration SQL is correct and includes all tables, indexes, and constraints.

This is a code-generation + manual-patch step. The migration files are committed as-is.

**Acceptance Criteria:**

- [ ] Migration SQL file exists in `packages/server/src/db/migrations/`
- [ ] First line of migration SQL is `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Migration creates all four tables (memories, memory_embeddings, tasks, ingestion_log)
- [ ] Migration creates GIN indexes on memories.search and memories.tags
- [ ] Migration creates unique constraint on memory_embeddings(memory_id, model)
- [ ] Migration creates unique index on ingestion_log(source, external_id)
- [ ] No HNSW vector index is present (deferred to Phase 7.5)
- [ ] `npm run typecheck` passes

---

### L2: verify-milestone — Integration verification of db:migrate

**Depends on:** db-client-schema, first-migration
**Branch:** `feat/phase-1-verify-milestone`
**Files:**

- `packages/server/src/db/migrate.ts` (modify — minor cleanup if needed)
- `packages/types/index.ts` (modify — ensure Db type re-exported if needed)

**Description:**
Final integration step: ensure `npm run db:migrate` works end-to-end against a running
PostgreSQL+pgvector instance. Verify the Db type is properly exported and usable by
downstream services. Clean up any remaining type mismatches between shared types and
Drizzle inferred types — prefer Drizzle's `InferSelectModel` / `InferInsertModel` to
keep types in sync with the schema automatically, updating `packages/types/` accordingly.

This item ties everything together and validates the Phase 1 milestone.

**Acceptance Criteria:**

- [ ] `npm run db:migrate` completes successfully against a fresh pgvector database
- [ ] All four tables are created with correct columns and constraints
- [ ] `Db` type is importable from the types package or server/db/client
- [ ] `Memory`, `NewMemory`, `Task`, `NewTask` types align with Drizzle schema (inferred via `InferSelectModel`/`InferInsertModel`)
- [ ] `npm run typecheck` passes
- [ ] `npm run test:run` passes
- [ ] `npm run lint` passes
