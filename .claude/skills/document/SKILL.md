# /document — Create or update wiki documentation

## Description

Creates or updates a wiki documentation page for a feature, service, or process in the Pensieve codebase.

## Usage

```
/document <feature or process name>
```

Example: `/document memory ingestion pipeline`

## Instructions

You are creating or updating wiki documentation. Follow these steps:

### 1. Understand the topic

Read the user's topic from `$ARGUMENTS`. The topic is a feature, service, process, or architectural concept in the Pensieve codebase.

### 2. Explore the codebase

Use Read, Grep, and Glob to find all relevant code:
- Services in `packages/server/src/services/`
- Handlers in `packages/server/src/handlers/`
- Types in `packages/types/`
- Database schema in `packages/server/src/db/schema/`
- Tests for understanding behavior
- Existing orchestrators and entry points

Build a complete picture of the feature: what files are involved, how data flows, what the public API looks like.

### 3. Check existing docs

Read all files in `docs/wiki/` to:
- Avoid creating a duplicate page for something already documented
- Find related pages to cross-reference
- If a page for this topic already exists, update it instead of creating a new one

### 4. Generate the documentation page

Create a markdown file with this exact structure:

```markdown
---
title: <Page Title>
description: <One-line description>
sources:
  - <path/to/source-file-1.ts>
  - <path/to/source-file-2.ts>
---

# <Page Title>

## Overview

<2-3 paragraphs explaining what this feature/process does, why it exists, and how it fits into the larger system.>

## Flow

<Mermaid diagram showing the process flow, data flow, or architecture. Use the appropriate diagram type:>
- `graph TD` for process/data flows
- `sequenceDiagram` for interactions between components
- `classDiagram` for type relationships (use as structure diagram, not OOP)

## Components

### <Component Name>

[`functionName`](https://github.com/ilarinie/pensieve/blob/main/path/to/file.ts)

<Description of what this component does, its parameters, and its role in the feature.>

### <Next Component>

...

## Related Pages

- [Related Page](related-page) — brief description of relationship
```

### 5. Frontmatter rules

The `sources` list in frontmatter is critical — it drives staleness detection during PR reviews:
- List every source file that this documentation page describes
- Use repo-relative paths (e.g., `packages/server/src/services/memory/store-memory.ts`)
- Include service files, handler files, type files, and schema files
- Do NOT include test files in sources

### 6. File naming

- Use kebab-case: `memory-ingestion-pipeline.md`, `health-check-endpoint.md`
- The file name should match the page title (slugified)
- Write to `docs/wiki/<page-slug>.md`

### 7. Update the sidebar

After writing the page, update `docs/wiki/_Sidebar.md`:
- Add the new page to the navigation list
- Keep pages in alphabetical order (after Home)
- Use wiki-style links: `[Page Title](page-slug)`

### 8. Report to user

Tell the user:
- The file path of the created/updated page
- A summary of what was documented
- Which source files are tracked in `sources`
- Suggest reviewing the page before committing

## Allowed tools

Read, Grep, Glob, Write

## Important

- Do NOT commit, push, or run git commands — the user handles that
- Do NOT modify any source code — only create/update documentation
- Always include Mermaid diagrams — they are a key part of every doc page
- Always include source links using `https://github.com/ilarinie/pensieve/blob/main/...` URLs
- Keep the writing concise and technical — this is developer documentation, not a tutorial
