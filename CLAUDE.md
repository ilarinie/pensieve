# Pensieve — Development Rules

## Project Overview

Pensieve is a personal memory assistant. Telegram bot interface, PostgreSQL + pgvector
storage, Ollama embeddings, Claude API for reasoning. Single TypeScript process runs
Express health endpoint + Telegram bot + cron scheduler.

Monorepo: packages/server (runtime), packages/types (shared types).

## Commands

```
npm run dev        — start server with tsx watch
npm run build      — compile TypeScript
npm run test       — vitest watch mode
npm run test:run   — vitest single run
npm run lint       — eslint server package
npm run format     — prettier write
npm run format:check — prettier check
npm run typecheck  — tsc -b --noEmit
npm run db:generate — drizzle-kit generate migration
npm run db:migrate  — run migrations
```

## Code Style — Absolute Rules

These are enforced by ESLint and must never be violated:

1. **Functional only** — NO classes. `no-restricted-syntax` ESLint rule with `ClassDeclaration` selector set to `error`
2. **One named export per file** — each .ts file exports exactly one thing. Barrel `index.ts` files for re-exports only
3. **No semicolons** — `semi: ['error', 'never']`
4. **Single quotes** — `quotes: ['error', 'single']`
5. **No console.log** — `no-console: 'error'`. Use Winston logger via `getLogger(import.meta.url)`
6. **Import extensions required** — always `.js` on relative imports. `import/extensions: ['error', 'always']`
7. **const + arrow for exports** — `export const fn = async (...) => { ... }`
8. **type not interface** — use `type` keyword for all type aliases (functional style)

## File Conventions

- **kebab-case** for all file names: `store-memory.ts`, `embedding-queue.ts`
- **Co-located tests**: `store-memory.ts` ↔ `store-memory.test.ts` (same directory)
- **File named after export**: file `store-memory.ts` exports `storeMemory`
- **Barrel files** (`index.ts`) contain only re-exports, zero logic
- **Test factories** in `__test-utils__/` directory

## TSDoc Requirements

Every exported function must have a TSDoc comment. The comment must match the actual implementation:

```typescript
/**
 * Stores a new memory in the database.
 *
 * @param db - Drizzle database instance
 * @param input - Memory content and metadata to store
 * @returns The created memory record with generated ID
 */
export const storeMemory = async (
  db: Db,
  input: NewMemory,
): Promise<Memory> => { ... }
```

Rules:
- `@param` for every parameter, description must match what the param actually is
- `@returns` describing the return value
- Summary line describing what the function does (not how)
- If function signature changes, TSDoc MUST be updated in the same commit

## Orchestrator Pattern

Main processes are written as top-to-bottom sequences of named function calls:

```typescript
export const processIncomingMessage = async (ctx: BotContext): Promise<void> => {
  const memory = await storeMemory(db, { content: ctx.message.text, source: 'telegram' })
  await enqueueEmbedding(memory.id)
  const hasTask = await triageForTask(memory.content)
  if (hasTask) {
    const tasks = await extractTasks(memory.content)
    await notifyUserOfTasks(ctx.chatId, tasks)
  }
}
```

Rules:
- Orchestrators contain NO business logic — only calls + control flow
- Each called function is independently testable
- Error handling wraps the orchestrator level (try/catch around the whole flow)
- Orchestrators live in handler/entry-point files, not in service directories

## Testing (TDD)

Workflow: write test first → implement → refactor → verify green

Conventions:
- `describe('functionName', () => { ... })` — named after the exported function
- `test('should ...', () => { ... })` — not `it`, descriptive sentence
- `import { describe, test, expect, vi, beforeEach } from 'vitest'`
- Arrange-Act-Assert pattern within each test
- Mock external deps with `vi.mock()` at module level
- Dependency injection: pass `db` as parameter, easy to mock
- Test factories in `__test-utils__/` for reusable test data
- supertest for HTTP endpoint tests

## Error Handling

- Result pattern for expected errors: `type Result<T> = { data: T } | { error: AppError }`
- Only throw for truly unexpected/fatal errors (unrecoverable state)
- Always log errors with context: `logger.error('Failed to store memory', { error: err.message, memoryId })`
- Wrap external API errors with meaningful messages

## Git Workflow

Fully automatic — branches, commits, rebases, merges happen without user confirmation.

Branch naming:
- Phase work: `feat/phase-N-short-name`
- Feature: `feat/description`
- Fix: `fix/description`

Commit format: `<type>: <description>`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
- Lowercase, imperative mood, no period, under 72 chars
- **NO Co-Authored-By or any other signatures**
- **NO GPG signatures**

Merge strategy:
- Always `git rebase main` before merge
- Always `git merge --ff-only` — no merge commits
- Delete branch after merge
- Every development item gets its own branch

## Dependency Injection Pattern

All functions that need external resources take them as first parameter(s). No module-level `getDb()` or singleton imports.

```typescript
// Correct — explicit, testable without vi.mock()
export const storeMemory = async (db: Db, input: NewMemory) => { ... }
export const generateEmbedding = async (ollamaUrl: string, text: string) => { ... }

// Wrong — hidden dependency, requires vi.mock() to test
export const storeMemory = async (input: NewMemory) => {
  const db = getDbClient()
}
```

In tests, pass a mock directly: `storeMemory(mockDb, testInput)`. No `vi.mock()` needed for DI'd deps.

## Import Order

Managed automatically by Prettier with @trivago/prettier-plugin-sort-imports:
1. External packages (node_modules)
2. Type imports from `../../types/`
3. Local imports (`./` and `../`)

## Environment Variables

All validated at startup via Zod in `env.ts`. App crashes immediately on missing/invalid vars.

## Type Conventions

- Shared types in `packages/types/`, one type per file
- Use `type` not `interface` (functional style)
- Prefer Zod schemas with `z.infer<typeof schema>` for runtime-validated types
