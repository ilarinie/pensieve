---
feature: Phase 2 — Telegram Bot + Memory Ingestion
description: >
  Add the Telegram bot interface (grammY) with auth middleware, an Ollama
  embedding service, a p-limit concurrency-controlled embedding queue, and the
  async ingestion pipeline. Users send text messages to the bot, which stores
  the memory immediately, replies "Stored.", and enqueues a background job to
  generate and persist the embedding. Milestone: send message to bot → instant
  reply → embedding appears in DB shortly after.
labels:
  - feature
  - phase-2
---

## Work Items

### L0: store-memory — Memory storage service with dedup

**Branch:** `feat/phase-2-store-memory`
**Files:**

- `packages/server/src/services/memory/store-memory.ts` (new)
- `packages/server/src/services/memory/store-memory.test.ts` (new)
- `packages/server/src/services/memory/index.ts` (new — barrel)

**Description:**
Service function that inserts a memory into the `memories` table and creates a
corresponding `ingestion_log` entry for deduplication. Accepts a Drizzle `db`
instance, memory content/metadata, and optional dedup fields (source, externalId).
Computes a SHA-256 dedup hash from sender + timestamp + content. Returns the
created memory or a dedup-skip result if the entry already exists.

**Acceptance Criteria:**

- [ ] `storeMemory(db, input)` inserts into `memories` and `ingestion_log` tables
- [ ] Computes SHA-256 dedup hash from `source + sourceDate + content`
- [ ] Returns `{ data: Memory }` on success
- [ ] Returns `{ data: null, deduplicated: true }` when dedup hash already exists
- [ ] Uses a transaction to ensure atomicity (memory + log inserted together)
- [ ] Follows DI pattern — `db` is first parameter
- [ ] TSDoc on exported function
- [ ] Tests mock Drizzle db, verify insert calls and dedup behavior
- [ ] `npm run typecheck && npm run test:run && npm run lint` pass

---

### L0: embedding-service — Ollama embedding client

**Branch:** `feat/phase-2-embedding-service`
**Files:**

- `packages/server/src/services/embedding/generate-embedding.ts` (new)
- `packages/server/src/services/embedding/generate-embedding.test.ts` (new)
- `packages/server/src/services/embedding/index.ts` (new — barrel)

**Description:**
Function that calls the Ollama `/api/embed` endpoint to generate a vector
embedding for a given text string. Uses native `fetch` (no extra HTTP library).
Returns the embedding as a `number[]`. Wraps Ollama errors with meaningful
messages. The Ollama base URL is passed as a parameter (DI).

**Acceptance Criteria:**

- [ ] `generateEmbedding(ollamaUrl, model, text)` returns `number[]`
- [ ] Calls `POST {ollamaUrl}/api/embed` with `{ model, input: text }`
- [ ] Returns the embedding vector from the response
- [ ] Throws a descriptive error on non-OK responses or network failures
- [ ] Follows DI pattern — `ollamaUrl` and `model` are parameters
- [ ] TSDoc on exported function
- [ ] Tests mock `fetch`, verify request shape and error handling
- [ ] `npm run typecheck && npm run test:run && npm run lint` pass

---

### L0: bot-setup — grammY bot factory and auth middleware

**Branch:** `feat/phase-2-bot-setup`
**Files:**

- `packages/server/src/bot/create-bot.ts` (new)
- `packages/server/src/bot/create-bot.test.ts` (new)
- `packages/server/src/bot/middleware/auth.ts` (new)
- `packages/server/src/bot/middleware/auth.test.ts` (new)
- `packages/server/src/bot/index.ts` (new — barrel)

**Description:**
Factory function that creates and configures a grammY `Bot` instance with auth
middleware. The auth middleware checks incoming updates against the whitelist of
allowed Telegram user IDs (from env). Unauthorized users receive a "Not
authorized." reply and the update is not processed further. The bot is created
with long polling for development; webhook support deferred to Phase 9
(deployment).

**Acceptance Criteria:**

- [ ] `createBot(token, allowedUserIds)` returns a configured grammY `Bot` instance
- [ ] Auth middleware rejects messages from non-whitelisted user IDs
- [ ] Auth middleware allows messages from whitelisted user IDs
- [ ] Unauthorized users receive "Not authorized." reply
- [ ] Bot token and allowed user IDs are passed as parameters (DI, not read from env)
- [ ] TSDoc on all exported functions
- [ ] Tests verify auth middleware allows/rejects correctly (mock grammY context)
- [ ] `npm run typecheck && npm run test:run && npm run lint` pass

---

### L1: embedding-queue — Async embedding processor with p-limit

**Depends on:** embedding-service
**Branch:** `feat/phase-2-embedding-queue`
**Files:**

- `packages/server/src/services/embedding/embedding-queue.ts` (new)
- `packages/server/src/services/embedding/embedding-queue.test.ts` (new)
- `packages/server/src/services/embedding/index.ts` (modify — add re-export)

**Description:**
Creates a concurrency-controlled embedding queue using `p-limit` (concurrency=3).
The queue accepts memory IDs, fetches the memory content from the DB, calls
`generateEmbedding` to produce the vector, and writes it to the
`memory_embeddings` table. Errors are logged but do not propagate (fire-and-forget
from the caller's perspective). Provides an `enqueue` function that returns
immediately (non-blocking) and a `drain` function for graceful shutdown.

**Acceptance Criteria:**

- [ ] `createEmbeddingQueue(deps)` returns `{ enqueue, drain }` where deps includes db, ollamaUrl, model
- [ ] `enqueue(memoryId)` returns immediately (non-blocking)
- [ ] Queue fetches memory content from DB by ID
- [ ] Queue calls `generateEmbedding` to produce the vector
- [ ] Queue inserts embedding into `memory_embeddings` table
- [ ] Concurrency limited to 3 via `p-limit`
- [ ] Errors are logged with context (memoryId, error message) but do not throw
- [ ] `drain()` waits for all pending jobs to complete (for graceful shutdown)
- [ ] Skips if memory not found or already has an embedding for the model
- [ ] TSDoc on exported function
- [ ] Tests mock DB + generateEmbedding, verify enqueue/drain behavior and error handling
- [ ] `npm run typecheck && npm run test:run && npm run lint` pass

---

### L2: message-handler — Bot message handling orchestrator

**Depends on:** store-memory, embedding-queue, bot-setup
**Branch:** `feat/phase-2-message-handler`
**Files:**

- `packages/server/src/bot/handlers/on-message.ts` (new)
- `packages/server/src/bot/handlers/on-message.test.ts` (new)
- `packages/server/src/bot/handlers/index.ts` (new — barrel)
- `packages/server/src/bot/create-bot.ts` (modify — register handler)

**Description:**
Orchestrator that handles incoming text messages on the Telegram bot. Follows the
orchestrator pattern: calls `storeMemory` to persist the message, enqueues an
embedding job via the embedding queue, and replies "Stored." to the user. Contains
no business logic — only calls to named functions and control flow. The handler is
registered on the bot in `create-bot.ts`.

**Acceptance Criteria:**

- [ ] `registerMessageHandler(bot, deps)` registers a `bot.on('message:text', ...)` handler
- [ ] Handler calls `storeMemory` with content from `ctx.message.text`, source `'telegram'`, and Telegram message metadata
- [ ] Handler calls `embeddingQueue.enqueue(memory.id)` after storing
- [ ] Handler replies "Stored." to the user via `ctx.reply`
- [ ] If dedup detects a duplicate, replies "Already stored." instead
- [ ] Handler includes Telegram message ID as `externalId` for dedup
- [ ] Errors are caught at orchestrator level, logged, and user gets "Something went wrong." reply
- [ ] Follows orchestrator pattern — no business logic in handler, only calls + control flow
- [ ] TSDoc on exported function
- [ ] Tests mock storeMemory, embeddingQueue, and ctx — verify call sequence
- [ ] `npm run typecheck && npm run test:run && npm run lint` pass

---

### L2: app-startup — Wire bot, queue, and DB in application entry point

**Depends on:** message-handler, embedding-queue, bot-setup
**Branch:** `feat/phase-2-app-startup`
**Files:**

- `packages/server/src/index.ts` (modify — async startup, initialize all services)
- `packages/server/src/index.test.ts` (new — optional, verify startup wiring)

**Description:**
Refactor the application entry point into an async `startServer` function that
initializes all services in order: create DB client, create embedding queue,
create bot (with message handler registered), start Express server, start bot
long polling. Add graceful shutdown handling (SIGTERM/SIGINT) that stops the bot,
drains the embedding queue, and closes the DB connection.

**Acceptance Criteria:**

- [ ] `startServer()` is an async function that initializes services in order
- [ ] Creates DB client via `createDb()`
- [ ] Creates embedding queue via `createEmbeddingQueue(deps)`
- [ ] Creates bot via `createBot(token, allowedUserIds)` with message handler registered
- [ ] Starts Express on configured port
- [ ] Starts bot long polling via `bot.start()`
- [ ] Registers SIGTERM/SIGINT handlers for graceful shutdown
- [ ] Graceful shutdown: stops bot → drains embedding queue → logs "Shutdown complete"
- [ ] Runs DB migrations before starting (via `runMigrations`)
- [ ] All dependencies wired via function parameters (no hidden singletons)
- [ ] `npm run typecheck && npm run lint` pass
