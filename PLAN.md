# Pensieve - Personal Memory Assistant: Implementation Plan

## Context

Build a personal "Pensieve" (Dumbledore's memory well) — a system to dump thoughts, tasks, and messages into, then query via chat. The assistant auto-extracts tasks, generates daily digests, and supports semantic search over all stored memories. Primary interface is a Telegram bot (works on Mac + phone). Deployed on existing Docker Swarm infrastructure.

## Confirmed Decisions

| Area | Decision |
|------|----------|
| **Interface** | Telegram bot (grammY, long polling dev / webhooks prod) |
| **WhatsApp** | Manual chat export → send .txt to Telegram bot for ingestion. Baileys as future option |
| **Telegram history** | gramjs Client API to ingest existing conversations |
| **Calendar** | Skip for now |
| **Web UI** | None initially |
| **Database** | PostgreSQL 16 + pgvector (structured + FTS + vector in one DB) |
| **Embeddings** | Ollama (nomic-embed-text) locally, swappable to Voyage AI later |
| **LLM** | Claude API for reasoning, chat, task extraction, daily compilation |
| **Connectors** | Simple tool registry — each connector is a TS file with standard interface, auto-registered as Claude tool |
| **Package manager** | npm + Node.js (npm workspaces, package-lock.json) |
| **Docker base** | node:20-slim (matches shopperfish/stack-manager infra) |
| **Deployment** | Docker Swarm + Traefik on `pensieve.saturanta.net` |

## Architecture

Single TypeScript monorepo (npm workspaces: `packages/server`, `packages/types`). One Express process runs the HTTP health endpoint, Telegram bot, and cron scheduler. PostgreSQL + pgvector handles all storage and search. Ollama provides local embeddings.

### Docker Stack (3 services)
- **pensieve** — the TypeScript app
- **postgres** — pgvector/pgvector:pg16
- **ollama** — ollama/ollama with nomic-embed-text model

## Database Schema

### `memories` table
- `id` (UUID), `content` (text)
- `search` (tsvector — `customType` + `generatedAlwaysAs(to_tsvector('english', content))`)
- `category`, `source`, `tags` (text[]), `metadata` (JSONB)
- `source_date` (timestamptz), `created_at`, `updated_at`
- `deleted_at` (timestamptz, nullable) — soft deletes with audit trail
- Indexes: GIN on search (tsvector), GIN on tags

### `memory_embeddings` table (separate for model-swap flexibility)
- `id` (UUID), `memory_id` (FK → memories), `model` (text, e.g. "nomic-embed-text")
- `embedding` (vector(768) — native Drizzle type, dimension varies by model)
- `created_at`
- Indexes: NO vector index in initial migration (exact scan is fast for <10k rows). HNSW index created via separate migration AFTER bulk imports.
- Unique constraint: (memory_id, model)

### `tasks` table
- `id` (UUID), `title`, `description`, `status` (pending/done/snoozed/cancelled)
- `priority` (1-3), `due_date`, `reminder_at`, `snoozed_until` (timestamptz, nullable), `completed_at`
- `source_memory_id` (FK → memories)

### `ingestion_log` table (deduplication)
- `id`, `source`, `external_id`, `dedup_hash` (SHA-256 of sender+timestamp+content+sequence_index), `memory_id` (FK)
- Unique index on (source, external_id)

## Repository Structure

```
i-l-e-personal-assistant/
├── package.json              (npm workspaces, version for stack-manager)
├── Dockerfile
├── deploy.yml
├── CLAUDE.md
├── drizzle.config.ts
├── tsconfig.json
└── packages/
    ├── types/
    │   └── index.ts          (shared type exports)
    └── server/
        └── src/
            ├── index.ts      (entry: start Express + bot + cron)
            ├── app.ts        (Express app with /health-check)
            ├── bot.ts        (grammY bot setup + handlers)
            ├── env.ts        (Zod env validation)
            ├── db/
            │   ├── client.ts (Drizzle + postgres.js)
            │   ├── schema.ts (all tables + pgvector native type)
            │   ├── migrate.ts
            │   └── migrations/
            ├── bot/
            │   ├── handlers/  (on-message, on-document, on-command)
            │   └── middleware/ (auth - whitelist user IDs)
            └── services/
                ├── embedding/  (abstract interface + ollama impl + voyage stub + embedding-queue.ts)
                ├── memory/     (store-memory, search-memories with hybrid RRF, dedup)
                ├── task/       (extract-tasks via Claude tool use, get-due, update)
                ├── chat/       (answer-question — RAG pipeline with registered tools)
                ├── connectors/ (tool registry + individual connector files)
                │   ├── registry.ts      (discovers + registers all connectors)
                │   ├── connector.types.ts (Connector interface)
                │   └── shopping-list.ts (example connector)
                ├── ingestion/  (whatsapp-parser, telegram-history via gramjs)
                └── cron/       (daily-digest, task reminders)
```

## Implementation Phases

### Phase 1: Project Scaffold + Database
- Init monorepo with npm workspaces, TypeScript, Drizzle ORM
- Zod env validation, Winston logger (same pattern as shopperfish)
- Database schema with native Drizzle pgvector type + tsvector generated column
- First migration (manually prepend `CREATE EXTENSION IF NOT EXISTS vector`). Do NOT create HNSW vector index in this migration — exact scan is fast for <10k rows.
- Express app with `/health-check` endpoint
- **Milestone**: `npm run db:migrate` works, Express starts

### Phase 2: Telegram Bot + Memory Ingestion
- grammY bot with long polling (dev) / webhooks (prod), auth middleware (whitelist Telegram user IDs)
- Ollama embedding service (HTTP calls to `/api/embeddings`), wrapped in shared `EmbeddingQueue` (`p-limit`, concurrency=3) to prevent OOM during bulk operations
- Async ingestion pipeline: bot stores text to DB immediately → replies "Stored." → background job generates embedding + stores in `memory_embeddings`
- **Milestone**: Send message to bot, it replies instantly and embedding appears in DB shortly after

### Phase 3: RAG Chat (Claude)
- Hybrid search: pgvector cosine similarity + PostgreSQL FTS, merged with RRF
- `answer-question` service: embed query → search → fill memories into Claude context greedily by RRF rank until ~6000-token budget is hit (estimated as chars/4; truncate last memory if needed) → return answer. System prompt includes current Helsinki datetime + day of week for time-aware reasoning.
- `/ask` bot command
- **Milestone**: `/ask when did I mention X` returns a real answer

### Phase 4: Task Extraction
- **Triage step**: Haiku does a cheap binary check "does this contain a task?" — only positives go to full extraction
- Explicit `#todo` prefix bypasses triage and goes straight to extraction
- Claude tool use (Sonnet/Opus) to extract tasks with due dates from unstructured input. System prompt includes current Helsinki datetime + day of week so relative dates ("by Friday") resolve correctly.
- Bot reports detected tasks via follow-up message
- `/tasks`, `/done`, `/snooze` commands. `/snooze` accepts duration (e.g. `/snooze 3d`), sets `snoozed_until` timestamp.
- **Milestone**: "call dentist by Friday" auto-creates a task with due date; random thoughts don't trigger expensive Claude calls

### Phase 5: WhatsApp Export Ingestion
- Use `whatsapp-chat-parser` npm library (handles multiple date formats, iOS/Android). Configure `daysFirst: true` for Finnish dates. Add defensive wrapper: try daysFirst=true, fallback to false, validate dates are sane.
- Bot document handler: receive .txt file → parse → batch DB inserts (100 per INSERT) → push memory IDs onto shared `EmbeddingQueue`. Progress reported via bot message edits.
- Dedup hash includes `sequence_index` (per-sender counter within each minute bucket) to handle WhatsApp's minute-resolution timestamps.
- **Milestone**: Upload WhatsApp export, bot reports N messages ingested

### Phase 6: Daily Digest + Reminders
- Cron job at 07:00 Helsinki time: yesterday's memories + upcoming tasks → Claude generates digest → sends via bot
- Hourly cron: check tasks with `reminder_at` in next hour, send reminders. Also checks `status = 'snoozed' AND snoozed_until <= NOW()`, transitions back to pending, notifies user.
- **Milestone**: Daily morning message arrives automatically

### Phase 7: Telegram History Ingestion
- gramjs Client API integration
- One-time interactive auth script (`scripts/get-telegram-session.ts`) to generate session string
- Rate limiting: batches of 100 with 1-2s jitter. Set `client.floodSleepThreshold = 120` for auto-handling short waits. For FloodWaitErrors above threshold, catch explicitly, log wait time, sleep for exact `error.seconds * 1000` ms, retry same batch.
- Batch DB inserts (100 per INSERT), push memory IDs onto shared `EmbeddingQueue`. Progress reported via bot message edits.
- Checkpointing: save last ingested message ID so crashes resume, not restart
- `/ingest_telegram <chat_id>` command to import conversation history
- **Milestone**: Import an existing Telegram chat's history

### Phase 7.5: Create HNSW Vector Index
- Run migration to create HNSW index after bulk data imports are complete: `CREATE INDEX CONCURRENTLY idx_memory_embeddings_hnsw ON memory_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`
- **Milestone**: Vector similarity queries use index scan instead of sequential scan

### Phase 8: Connector/Tool Registry
- Define `Connector` interface: `{ name, description, inputSchema, execute(input) }`
- Build registry that auto-discovers connector files from `connectors/` directory
- Integrate with Claude chat: registered connectors become available as Claude tools during `/ask` conversations
- When Claude decides to use a tool (e.g., "add milk to shopping list"), the registry routes to the right connector's `execute()`
- Build example connector: shopping list app (token-based API call)
- Adding a new connector = writing one TS file implementing the interface
- **Milestone**: "add milk to the shopping list" via bot actually calls the shopping list API

### Phase 9: Docker + Deploy
- Dockerfile: `FROM node:20-slim`, copy `package-lock.json` + `package.json`, `npm ci`, copy source, `npm run build`, `CMD ["node", "dist/server/src/index.js"]`.
- deploy.yml with 3 services (app + postgres + ollama), Traefik labels, volumes
- Ollama container: memory reservation 2G, limit 4G to prevent OOM cascading
- Webhook setup for Telegram bot in production (Traefik handles SSL)
- Daily `pg_dump` backup cron (sidecar or host-level) to external storage
- Test with `stack-manager` deployment to purkkaMAX
- Post-deploy: exec into Ollama container to `ollama pull nomic-embed-text`
- **Milestone**: Running on `pensieve.saturanta.net`

## Key Technical Details

- **Drizzle pgvector**: Drizzle ORM has native `vector('embedding', { dimensions: 768 })` since v0.31.0, plus built-in `cosineDistance()`, `l2Distance()` helpers and HNSW index support via `.using('hnsw', t.embedding.op('vector_cosine_ops'))`. Note: HNSW index should NOT be in initial migration — defer until after bulk imports (Phase 7.5).
- **FTS with generated column**: Use `customType` for `tsvector` + Drizzle's `.generatedAlwaysAs()` to auto-populate the search column — no triggers needed. Query with `` sql`${memories.search} @@ plainto_tsquery('english', ${term})` ``
- **Hybrid search (RRF)**: Two separate queries (vector top-50, FTS top-50) via Drizzle `sql` template literals, merge scores with `1/(60+rank)`, sort by combined score. GIN index on tsvector required; HNSW vector index added after bulk imports. Results filled greedily by rank into ~6000-token budget (estimated as chars/4, no tokenizer library needed). Truncate last memory if it exceeds remaining budget.
- **Async ingestion pipeline**: Bot immediately stores text to DB and replies "Stored." — then fires off background jobs for embedding generation, Haiku task triage, and task extraction. If a task is found, bot sends a follow-up message. Zero latency on the user side.
- **Task triage (cost control)**: NOT every message goes to full Claude. Background pipeline uses Haiku for a cheap binary "contains task? yes/no" check first. Only invoke the heavier task extraction on positives. Also support explicit `#todo` prefix to bypass triage entirely.
- **Deduplication**: Two-level — `external_id` for known-ID sources (Telegram message IDs, WhatsApp line hashes) + `dedup_hash` (SHA-256 of **sender + timestamp + content + sequence_index**, not content alone — avoids dropping repeated short messages like "Ok"). The `sequence_index` is a per-sender counter within each minute bucket (0, 1, 2...) that disambiguates messages with identical sender+timestamp+content, fixing WhatsApp's minute-resolution timestamps.
- **Telegram bot: polling vs webhooks**: Long polling for local dev (`npm run dev`). Webhooks in production via Traefik (zero idle CPU, SSL handled by Traefik). grammY supports both natively. **Webhook security**: Use `X-Telegram-Bot-Api-Secret-Token` header validation (grammY built-in) to prevent forged webhook requests.
- **gramjs rate limiting**: Batches of 100 with 1-2s jitter. Set `client.floodSleepThreshold = 120` for auto-handling short waits. For FloodWaitErrors above threshold, catch explicitly, log wait time, sleep for exact `error.seconds * 1000` ms, retry same batch. Save checkpoint (last message ID) after each batch so ingestion resumes on crash, not restarts.
- **gramjs session**: Generated once interactively, stored as env var `TELEGRAM_SESSION_STRING`
- **Embedding swap**: Abstract `EmbeddingService` interface. To handle dimension changes cleanly (pgvector can't alter column dimensions in-place), store embeddings in a separate `memory_embeddings` table linked by `memory_id` with a `model` column. This lets you re-embed with a new model in parallel, then swap which model is used for search — no downtime, no data loss.
- **Ollama resource limits**: deploy.yml must set memory reservation (2G) and limit (4G) for Ollama container to prevent OOM from affecting Postgres/app. Set `OLLAMA_KEEP_ALIVE=0` to unload model from RAM immediately after each embedding call (prevents holding memory between requests). If server RAM is tight (<4GB free), skip Ollama and use Voyage AI from day one.
- **Connector registry**: Each connector file exports a `Connector` object (`name`, `description`, `inputSchema` as JSON Schema, `execute(input): Promise<string>`). Registry scans the directory at startup, converts each to a Claude tool definition, and passes them to `messages.create()`. When Claude returns a `tool_use` block, the registry dispatches to the matching connector's `execute()`. Adding a new connector requires zero changes to existing code — just a new file.
- **Embedding queue (concurrency control)**: All embedding requests go through a shared `EmbeddingQueue` using `p-limit` (concurrency=3). Bulk importers batch DB inserts (100 per INSERT) and push memory IDs onto the queue. Progress reported via bot message edits.
- **Time context injection**: All Claude system prompts include current Helsinki datetime + day of week, e.g. `Current time: Thursday, 2026-02-19 14:30 EET (Europe/Helsinki)`. Generated via `Intl.DateTimeFormat`. Timezone configurable via `TZ_DISPLAY` env var.
- **Soft deletes**: `deleted_at` column on memories. Implement Drizzle helper `activeMemories()` with `where(isNull(memories.deletedAt))`. All services must use this. `/forget` bot command sets `deleted_at = NOW()`.
- **Database backup**: Daily `pg_dump` cron (inside Postgres container or sidecar) shipping to external storage (S3, NAS, or rsync to another machine)
- **Package manager**: npm + Node.js (npm workspaces, package-lock.json). Standard toolchain — no extra runtime to install. `tsx` for dev mode, `tsc` for production builds.

## Key Dependencies

- `grammy` — Telegram bot
- `gramjs` (telegram) — Telegram Client API for history
- `@anthropic-ai/sdk` — Claude API
- `drizzle-orm` + `postgres` (postgres.js driver)
- `node-cron` — scheduling
- `zod` — env + schema validation
- `express` + `winston` — HTTP + logging (following shopperfish patterns)
- `tsx` — TypeScript execution for dev mode
- `p-limit` — concurrency limiter for embedding queue
- `whatsapp-chat-parser` — WhatsApp export parser (multi-format, iOS/Android)

## Reference Files
- `/Users/ilarinieminen/scripts/stack-manager` — deployment script (builds Docker image, pushes to purkkaMAX:5000, SCPs deploy.yml, runs `docker stack deploy`)
- `/Users/ilarinieminen/PersonalProjects/shopperfish/deploy.yml` — deploy.yml template (Traefik labels, healthcheck, volumes, networks)

## Verification

1. **Unit**: Send text to bot → verify it appears in `memories` table with embedding
2. **Search**: Store 10+ memories → `/ask` returns relevant results
3. **Tasks**: Send "remind me to call dentist by Friday" → verify task created with correct due date
4. **WhatsApp**: Export a chat, send to bot → verify messages ingested and deduplicated on re-send
5. **Digest**: Trigger digest manually → verify it summarizes recent memories and lists tasks
6. **Connectors**: Register a test connector → ask bot to invoke it → verify external API called
7. **Deploy**: `stack-manager i-l-e-personal-assistant` → verify bot responds on server
