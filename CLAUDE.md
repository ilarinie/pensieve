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
export const processIncomingMessage = async (
  ctx: BotContext,
): Promise<void> => {
  const memory = await storeMemory(db, {
    content: ctx.message.text,
    source: 'telegram',
  })
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

Fully automatic — branches, commits, rebases, PRs happen without user confirmation.

Branch naming:

- Phase work: `feat/phase-N-short-name`
- Feature: `feat/description`
- Fix: `fix/description`

Commit format: `<type>: <description>`

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
- Lowercase, imperative mood, no period, under 72 chars
- **NO Co-Authored-By or any other signatures**
- **NO GPG signatures**

PR workflow:

- Every issue gets its own branch and pull request
- Push the branch, create a PR with `gh pr create`
- PRs are reviewed (automated + human) before merging
- Use squash-merge or ff-only merge on GitHub

### Stacked PRs (PR trains)

When implementing multiple issues that depend on each other (e.g., L0 → L1 → L2):

1. **First issue**: branch from `main`, push, create PR targeting `main`
2. **Next issue**: branch from the previous issue's branch, push, create PR targeting the previous branch
3. Continue stacking — each PR shows only its own diff
4. Merge from bottom up: merge the first PR into `main`, then retarget the next PR to `main`, merge, repeat

Example for Phase N with issues #10 (L0), #11 (L1), #12 (L2):

```
main ← PR #A (feat/phase-n-types)
         ← PR #B (feat/phase-n-service)    [base: feat/phase-n-types]
              ← PR #C (feat/phase-n-handler) [base: feat/phase-n-service]
```

Rules:

- Each PR must be small enough for a single review pass
- PR description must note base branch if not `main`
- After merging bottom PR, retarget dependent PRs to `main` (or the new base)
- Delete branches after merge

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

## Documentation

Wiki documentation lives in `docs/wiki/` and syncs to the GitHub Wiki on merge to main.

- `/document <feature>` — create or update a wiki page
- Every doc page has YAML frontmatter with `sources:` listing the files it documents
- PR reviews check for doc staleness (changed source files → flagged wiki pages)
- Mermaid diagrams for process flows and architecture
- Code links use `/blob/main/...` URLs to the source files

## Planning Workflow

1. `/plan <description>` — create structured plan in `docs/plans/`
2. Review/edit the plan file
3. `/create-issues <plan-file>` — create GitHub issues with dependencies

Plans use the layer system (L0/L1/L2):

- L0: No dependencies on other new items (parallelizable)
- L1: Depends on L0 items
- L2: Orchestrators wiring everything together

## Implementation Workflow

Each issue = one branch = one PR. For dependent issues, use stacked PRs.

For each issue:

1. Create branch from base (main for L0, previous issue's branch for L1/L2)
2. Write tests first (TDD), implement, verify all checks pass
3. Commit with descriptive messages
4. Push and create PR (`gh pr create`)
   - Target `main` for L0 issues (or standalone work)
   - Target the previous issue's branch for dependent L1/L2 issues
5. Move to next issue, branching from the current branch

After review/merge:

- Merge PRs bottom-up (L0 first, then L1, then L2)
- Retarget dependent PRs to `main` after their base is merged
- Close corresponding GitHub issues
