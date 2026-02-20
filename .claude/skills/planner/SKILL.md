# /planner — Create a structured implementation plan

disable-model-invocation: true

## Description

Creates a structured plan file for a feature or phase, decomposed into layered work items suitable for parallel TDD implementation.

## Usage

```
/plan <feature description>
```

Example: `/plan Phase 3 - Cron scheduler and daily digest`

## Instructions

You are creating a structured implementation plan. Follow these steps:

### 1. Understand the request

Read the user's feature description from `$ARGUMENTS`. If the description is vague, ask one clarifying question before proceeding.

### 2. Explore the codebase

Use Read, Grep, and Glob to understand:

- Existing services, types, and patterns in `packages/server/src/`
- Shared types in `packages/types/`
- Database schema in `packages/server/src/db/schema/`
- Existing tests for style reference
- Any related existing code that the new feature will integrate with

### 3. Decompose into layered work items

Apply the layer system:

- **L0** — Independent items with no dependencies on other new items. These can be built in parallel. Typically: new types, standalone services, utility functions.
- **L1** — Items that depend on L0 items. Typically: services that use L0 services, API endpoints that use L0 types.
- **L2** — Orchestrators that wire everything together. Depend on L1 items. Typically: handler functions, integration points.

Each work item should be:

- Small enough for a single branch and PR
- Independently testable
- Named with a kebab-case slug (used as identifier before issue numbers exist)

### 4. Write the plan file

Create the file at `docs/plans/<feature-slug>.md` using this exact format:

```markdown
---
feature: <Feature Name>
description: >
  <One-paragraph description of what this feature does and why.>
labels:
  - <label1>
  - <label2>
---

## Work Items

### L0: <slug> — <Short title>

**Branch:** `feat/<phase-or-feature>-<slug>`
**Files:**

- <path/to/file.ts> (new|modify)
- <path/to/file.test.ts> (new|modify)

**Description:**
<What this work item does. 2-3 sentences.>

**Acceptance Criteria:**

- [ ] <Criterion 1>
- [ ] <Criterion 2>

---

### L1: <slug> — <Short title>

**Depends on:** <slug-of-L0-item>, <another-slug>
**Branch:** `feat/<phase-or-feature>-<slug>`
**Files:**

- <path/to/file.ts> (new|modify)

**Description:**
<What this work item does.>

**Acceptance Criteria:**

- [ ] <Criterion 1>

---

### L2: <slug> — <Short title>

**Depends on:** <slug-of-L1-item>
**Branch:** `feat/<phase-or-feature>-<slug>`
...
```

### 5. Format rules

- YAML frontmatter with `feature`, `description`, and `labels`
- Layer prefix `L0`/`L1`/`L2` determines parallelism grouping
- Item IDs are kebab-case slugs (e.g., `store-memory`, `embedding-queue`)
- `Depends on:` references slugs of items in earlier layers
- Each item specifies its branch name, files to create/modify, description, and acceptance criteria
- Acceptance criteria become issue checkboxes — make them specific and testable
- Separate work items with `---` horizontal rules

### 6. Present the plan

After writing the file, tell the user:

- The plan file path
- A summary of the layer structure (how many items per layer)
- Suggest they review and edit the file before running `/create-issues`

## Allowed tools

Read, Grep, Glob, Write

## Important

- Do NOT create issues, branches, or implement anything — only write the plan file
- Do NOT modify any source code
- Follow existing project conventions discovered during codebase exploration
- If unsure about scope, err on the side of smaller, more focused work items
