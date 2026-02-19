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

### GitHub Actions (`.github/workflows/`)

Four Claude Code workflows run on GitHub runners:

| Workflow | File | Trigger |
|----------|------|---------|
| PR Review | `claude-review.yml` | PR opened or updated |
| Implementation | `claude-implement.yml` | `@claude` comment or `claude:implement` label |
| Issue Triage | `claude-triage.yml` | New issue opened |
| Weekly Maintenance | `claude-maintenance.yml` | Monday 10:00 Helsinki (cron) or manual dispatch |

### GitHub MCP Server (local Claude Code)

Configured in `~/.claude/.mcp.json` using the official Docker image
(`ghcr.io/github/github-mcp-server`). Requires `GITHUB_PERSONAL_ACCESS_TOKEN`
env var and Docker running.

### Templates

- `.github/ISSUE_TEMPLATE/feature.md` — feature request template
- `.github/ISSUE_TEMPLATE/bug.md` — bug report template
- `.github/pull_request_template.md` — PR checklist (tests, types, lint, format, TSDoc)

---

## Secrets & Tokens

| Secret | Where | Purpose |
|--------|-------|---------|
| `ANTHROPIC_API_KEY` | GitHub repo secret | Claude API access for GitHub Actions |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `~/.zshrc` env var | GitHub MCP server in Claude Code |

---

## How to Use

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

### Issue-driven implementation

**Option A — `@claude` mention:**

1. Create an issue with a description of what to build
2. Comment `@claude implement this`
3. Claude reads CLAUDE.md, scans the codebase, creates a branch, implements, opens a PR
4. Review the PR — request changes with `@claude fix X`
5. Merge → issue auto-closes → board moves to Done

**Option B — label trigger:**

1. Create an issue
2. Add the `claude:implement` label
3. Same result — Claude implements and opens a PR

### Automatic PR review

Every PR gets an automatic Claude review checking:

- Functional style (no classes)
- Dependency injection (db as first param)
- TSDoc on every export
- Test coverage
- Security (OWASP top 10)
- Code style (no semicolons, single quotes, `.js` imports, `type` not `interface`)

The review posts inline comments and approves or requests changes.

### Automatic issue triage

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

## Day-to-Day Workflow

```
1. Create issue (GitHub UI or Claude Code + MCP)
   → Auto-triaged, labeled, added to board Backlog

2. Move to Todo when ready to plan

3. Implement:
   a. Self: create branch, code, push, open PR
   b. Claude: comment "@claude implement this" or add "claude:implement" label

4. PR opened → auto-reviewed by Claude
   → Board moves to In Review

5. Fix review comments, merge
   → Issue auto-closes, board moves to Done
```

---

## Planning Workflow

Structured workflow connecting planning → issue creation → parallel implementation.

### Skills

| Skill | Purpose |
|-------|---------|
| `/plan <description>` | Explore codebase, create structured plan in `docs/plans/` |
| `/create-issues <plan-file>` | Parse plan file, create parent + sub-issues with dependencies |
| `/implement <issue-number>` | Local TDD implementation of a single issue |

### Layer System

Plans decompose work into layers for parallelism:

| Layer | Label | Meaning |
|-------|-------|---------|
| L0 | `layer:0` | Independent, no deps on new items — parallelizable |
| L1 | `layer:1` | Depends on L0 items |
| L2 | `layer:2` | Orchestrators wiring L0+L1 together |

### Full Flow

```
/plan "Phase 3 - Cron scheduler"
  → Claude explores codebase, writes docs/plans/phase-3-cron-scheduler.md
  → User reviews/edits the plan file

/create-issues docs/plans/phase-3-cron-scheduler.md
  → Creates parent issue + sub-issues with blocked-by relationships
  → All added to project board in "Todo"

/implement 42  (local, interactive)
  — OR —
Add "claude:implement" label  (remote, async via GitHub Action)
  → Branch created, TDD implementation, PR opened

PR merged → issue auto-closes → board moves to Done
```

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

### GitHub Resources

| Resource | Node ID |
|----------|---------|
| Repo | `R_kgDORUITUg` |
| Project | `PVT_kwHOAHTkk84BPpUQ` |
| Status field | `PVTSSF_lAHOAHTkk84BPpUQzg9_rzQ` |
| "Todo" option | `2eec6910` |

---

## Maintenance

- **MCP server** requires Docker running (`docker ps` to verify)
- **PAT rotation:** regenerate `GITHUB_PERSONAL_ACCESS_TOKEN` periodically
  and update both `~/.zshrc` and any stored secrets
- **Workflow updates:** `anthropics/claude-code-action@v1` auto-updates within v1;
  check for major version bumps periodically
