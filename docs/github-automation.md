# GitHub Automation Setup

## What Was Set Up

### Repository

- **Repo:** `ilarinie/pensieve` (private) on GitHub
- **Remote:** `origin` → `git@github.com:ilarinie/pensieve.git`

### Project Board

- **URL:** https://github.com/users/ilarinie/projects/2
- **Columns:** Backlog → Todo → In Progress → In Review → Done
- **Built-in automations:**
  - New items → Backlog
  - Issue closed → Done
  - PR merged → Done

### Labels

| Label | Purpose |
|-------|---------|
| `claude:implement` | Triggers Claude to implement the issue |
| `feature` | New feature request |
| `bug` | Bug report |
| `question` | Needs clarification |
| `chore` | Maintenance task |
| `priority:critical` | Must fix immediately |
| `priority:high` | Important |
| `priority:medium` | Normal priority |
| `priority:low` | Nice to have |
| `layer:0` | Independent, parallelizable work item |
| `layer:1` | Depends on layer 0 items |
| `layer:2` | Orchestrator, depends on layer 1 items |

### GitHub Actions (`.github/workflows/`)

Four Claude Code workflows run on GitHub runners:

| Workflow | File | Trigger |
|----------|------|---------|
| PR Review | `claude-review.yml` | PR opened or updated |
| Implementation | `claude-implement.yml` | `@claude` comment or `claude:implement` label |
| Issue Triage | `claude-triage.yml` | New issue opened |
| Weekly Maintenance | `claude-maintenance.yml` | Monday 10:00 Helsinki (cron) or manual dispatch |

### Claude Code Skills (`.claude/skills/`)

Three skills for the planning → issues → implementation workflow:

| Skill | File | Purpose |
|-------|------|---------|
| `/plan` | `plan/SKILL.md` | Explore codebase, write structured plan file |
| `/create-issues` | `create-issues/SKILL.md` | Parse plan file, create GitHub issues with dependencies |
| `/implement` | `implement/SKILL.md` | Local TDD implementation of a single issue |

### GitHub MCP Server (local Claude Code)

Configured in `~/.claude/.mcp.json` using the official Docker image
(`ghcr.io/github/github-mcp-server`). Requires `GITHUB_PERSONAL_ACCESS_TOKEN`
env var and Docker running.

### Templates

- `.github/ISSUE_TEMPLATE/feature.md` — feature request template
- `.github/ISSUE_TEMPLATE/bug.md` — bug report template
- `.github/pull_request_template.md` — PR checklist (tests, types, lint, format, TSDoc)

### GitHub Resource IDs

Used by `/create-issues` skill for GraphQL API calls:

| Resource | Node ID |
|----------|---------|
| Repo | `R_kgDORUITUg` |
| Project | `PVT_kwHOAHTkk84BPpUQ` |
| Status field | `PVTSSF_lAHOAHTkk84BPpUQzg9_rzQ` |
| "Todo" option | `2eec6910` |

---

## Secrets & Tokens

| Secret | Where | Purpose |
|--------|-------|---------|
| `ANTHROPIC_API_KEY` | GitHub repo secret | Claude API access for GitHub Actions |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `~/.zshrc` env var | GitHub MCP server in Claude Code |

---

## Day-to-Day Workflow

### Planned work (features, phases)

The primary workflow for non-trivial work uses the three skills:

```
1. /plan "Phase 3 - Cron scheduler"
   → Claude explores codebase, writes docs/plans/phase-3-cron-scheduler.md

2. Review/edit the plan file

3. /create-issues docs/plans/phase-3-cron-scheduler.md
   → Parent issue + sub-issues created with blocked-by relationships
   → All added to project board in "Todo"

4. /implement 42  (local, interactive)
     — OR —
   Add "claude:implement" label  (remote, async via GitHub Action)
   → Branch created, TDD implementation, PR opened

5. PR opened → auto-reviewed by Claude
   → Board moves to In Review

6. Merge PR
   → Issue auto-closes → board moves to Done → parent shows progress
```

### Ad-hoc work (bugs, small tasks)

For one-off issues that don't need a plan:

```
1. Create issue (GitHub UI or Claude Code + MCP)
   → Auto-triaged, labeled, added to board Backlog

2. Implement:
   a. /implement <number>  (local)
   b. Comment "@claude implement this"  (remote)
   c. Add "claude:implement" label  (remote)

3. PR opened → auto-reviewed by Claude

4. Merge → issue auto-closes → board moves to Done
```

### From the terminal (Claude Code + MCP)

With the GitHub MCP server running, Claude Code can interact with GitHub directly:

```
"Create an issue for adding the embedding queue service"
→ Creates issue on GitHub, appears in project board Backlog

"List open issues on pensieve"
→ Fetches and displays issues via MCP

"Create a PR for the current branch"
→ Opens a PR on GitHub
```

---

## Layer System

Plans decompose features into layered work items for parallel implementation:

| Layer | Label | Meaning | Examples |
|-------|-------|---------|----------|
| L0 | `layer:0` | No deps on other new items — parallelizable | Types, standalone services, utilities |
| L1 | `layer:1` | Depends on L0 items | Services using L0 types, endpoints |
| L2 | `layer:2` | Orchestrators wiring L0+L1 together | Handlers, integration points |

Each work item = one sub-issue = one branch = one PR. All L0 items can be
implemented in parallel. L1 items start after their L0 dependencies merge.
L2 items start last.

### Plan File Format

Plan files live in `docs/plans/` with YAML frontmatter and layered work items:

```markdown
---
feature: Phase 3 - Cron Scheduler
description: >
  Add cron-based scheduling for daily digest emails.
labels:
  - feature
---

## Work Items

### L0: schedule-config — Schedule configuration service
**Branch:** `feat/phase-3-schedule-config`
**Files:**
- packages/types/schedule.ts (new)
- packages/server/src/services/schedule/schedule-config.ts (new)
- packages/server/src/services/schedule/schedule-config.test.ts (new)

**Description:**
Parse and validate cron schedule configurations.

**Acceptance Criteria:**
- [ ] Validates cron expressions
- [ ] Returns parsed schedule object

---

### L1: cron-runner — Cron job runner
**Depends on:** schedule-config
**Branch:** `feat/phase-3-cron-runner`
...
```

---

## Automatic Workflows

### PR review

Every PR gets an automatic Claude review checking:

- Functional style (no classes)
- Dependency injection (db as first param)
- TSDoc on every export
- Test coverage
- Security (OWASP top 10)
- Code style (no semicolons, single quotes, `.js` imports, `type` not `interface`)

The review posts inline comments and approves or requests changes.

### Issue triage

Every new issue is automatically analyzed by Claude:

- Categorized as bug/feature/question/chore
- Priority assessed (critical/high/medium/low)
- Labels applied
- Duplicate check performed

### Weekly maintenance

Runs every Monday at 10:00 Helsinki (8:00 UTC). Can also be triggered manually
from Actions → Weekly Maintenance → Run workflow.

Checks:
- Outdated dependencies
- Security vulnerabilities (npm audit)
- Stale issues (>30 days)
- TODO/FIXME comments
- Missing tests

Creates a summary issue with findings.

---

## Wiki Documentation

### Overview

Documentation source lives in `docs/wiki/` in the main repo. A GitHub Action syncs
content to the GitHub Wiki on merge to main. Mermaid diagrams render natively in both
the repo and wiki views.

### Wiki Sync Action

**File:** `.github/workflows/wiki-sync.yml`

| Skill | Purpose |
|-------|---------|
| `/plan <description>` | Explore codebase, create structured plan in `docs/plans/` |
| `/create-issues <plan-file>` | Parse plan file, create parent + sub-issues with dependencies |

**Prerequisite:** The wiki must be initialized manually via the GitHub UI (Settings →
enable Wiki → create Home page). Actions cannot create the wiki repo.

### `/document` Skill

**File:** `.claude/skills/document/SKILL.md`

Creates or updates wiki pages:

```
/document <feature or process name>
```

Implementation: each issue → branch → PR (stacked for dependent issues)
  → TDD implementation, push branch, create PR
  → Automated review via claude-review workflow
  → Merge bottom-up (L0 → L1 → L2)

The skill does NOT commit or push — that follows the normal git workflow.

### Doc Page Format

Every wiki page uses YAML frontmatter:

```markdown
---
title: Feature Name
description: One-line description
sources:
  - packages/server/src/services/feature/service.ts
  - packages/server/src/handlers/feature-handler.ts
---
```

The `sources` list is the staleness detection mechanism — it lists every source file
the page documents.

### Staleness Detection in PR Review

The Claude PR review workflow (`.github/workflows/claude-review.yml`) includes a
documentation check:

- If any file in the PR diff appears in a doc page's `sources:`, the review flags
  that the documentation may need updating
- If new service or handler files are added without being listed in any doc page's
  `sources`, the review suggests creating documentation

This piggybacks on the existing review — no extra workflow or CI minutes.

---

## Maintenance

- **MCP server** requires Docker running (`docker ps` to verify)
- **PAT rotation:** regenerate `GITHUB_PERSONAL_ACCESS_TOKEN` periodically
  and update both `~/.zshrc` and any stored secrets
- **Workflow updates:** `anthropics/claude-code-action@v1` auto-updates within v1;
  check for major version bumps periodically
