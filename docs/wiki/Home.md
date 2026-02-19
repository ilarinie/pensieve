# Pensieve Documentation

Pensieve is a personal memory assistant with a Telegram bot interface, PostgreSQL + pgvector storage, Ollama embeddings, and Claude API for reasoning.

## Architecture

- **Monorepo:** `packages/server` (runtime) + `packages/types` (shared types)
- **Runtime:** Single TypeScript process running Express health endpoint + Telegram bot + cron scheduler
- **Storage:** PostgreSQL with pgvector for semantic search
- **Embeddings:** Ollama for local embedding generation
- **Reasoning:** Claude API for intelligent responses

## Pages

- [Home](Home) — This page

## Development

- See [CLAUDE.md](https://github.com/ilarinie/pensieve/blob/main/CLAUDE.md) for development rules
- See [GitHub Automation](https://github.com/ilarinie/pensieve/blob/main/docs/github-automation.md) for CI/CD and workflow docs
