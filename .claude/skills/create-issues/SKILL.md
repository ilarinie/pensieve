# /create-issues — Create GitHub issues from a plan file

disable-model-invocation: true

## Description

Parses a structured plan file and creates a parent GitHub issue with sub-issues, dependencies, and project board integration.

## Usage

```
/create-issues <path-to-plan-file>
```

Example: `/create-issues docs/plans/phase-2-telegram-bot.md`

## Instructions

You are creating GitHub issues from a plan file. Follow these steps precisely.

### Hardcoded IDs

| Resource | Node ID |
|----------|---------|
| Repo owner | `ilarinie` |
| Repo name | `pensieve` |
| Repo node ID | `R_kgDORUITUg` |
| Project node ID | `PVT_kwHOAHTkk84BPpUQ` |
| Status field ID | `PVTSSF_lAHOAHTkk84BPpUQzg9_rzQ` |
| "Todo" option ID | `2eec6910` |

### 1. Read and parse the plan file

Read the file at `$ARGUMENTS`. Parse:
- **YAML frontmatter**: `feature`, `description`, `labels`
- **Work items**: Extract each `### L<N>: <slug> — <title>` section with its fields

If the file doesn't exist or can't be parsed, tell the user and stop.

### 2. Create layer labels (if missing)

Check if labels exist, create if needed:

```bash
gh label create "layer:0" --color "0e8a16" --description "Independent, parallelizable" --repo ilarinie/pensieve --force
gh label create "layer:1" --color "fbca04" --description "Depends on layer 0" --repo ilarinie/pensieve --force
gh label create "layer:2" --color "ff9f1c" --description "Orchestrator, depends on layer 1" --repo ilarinie/pensieve --force
```

### 3. Create the parent issue

Create a parent issue with the feature title and description:

```bash
gh issue create \
  --repo ilarinie/pensieve \
  --title "<feature from frontmatter>" \
  --body "<description from frontmatter + summary table of work items>" \
  --label "<labels from frontmatter, comma-separated>"
```

Capture the issue number and node ID from the output. To get the node ID:

```bash
gh issue view <number> --repo ilarinie/pensieve --json id --jq '.id'
```

### 4. Create sub-issues

For each work item, create a sub-issue using GraphQL (to set parentIssueId):

```bash
gh api graphql -f query='
  mutation {
    createIssue(input: {
      repositoryId: "R_kgDORUITUg"
      title: "<slug>: <title>"
      body: "<description + acceptance criteria as checkboxes>"
      parentIssueId: "<parent node ID>"
    }) {
      issue {
        id
        number
      }
    }
  }
'
```

After creating each sub-issue:
- Store the mapping: `slug → { nodeId, number }`
- Add labels using `gh issue edit <number> --add-label "layer:<N>,claude:implement,<frontmatter labels>"`

### 5. Set dependency relationships

For each work item that has a `Depends on:` field, set blocked-by relationships:

```bash
gh api graphql -f query='
  mutation {
    addSubIssueToIssue(input: {
      issueId: "<dependent issue node ID>"
      subIssueId: "<blocking issue node ID>"
    }) {
      issue { id }
    }
  }
'
```

Wait — that's the sub-issue mutation. For **dependencies** (blocked-by), use:

```bash
gh api graphql -f query='
  mutation {
    createLinkedBranch(input: {
      issueId: "<issue node ID>"
      oid: "main"
      name: "<branch name>"
      repositoryId: "R_kgDORUITUg"
    }) {
      linkedBranch { id }
    }
  }
'
```

Actually, for blocked-by dependencies, the correct approach is to use issue type links. Since the GitHub GraphQL API for issue dependencies may vary, use the REST-based approach:

For each item with `Depends on: <slug>`:
1. Look up the blocking issue number from the slug mapping
2. Add a "blocked by #N" line to the issue body, or use the GraphQL `addIssueRelation` mutation if available

**Practical approach**: Update each dependent issue's body to include a "Blocked by" section:

```bash
# Get current body
BODY=$(gh issue view <number> --repo ilarinie/pensieve --json body --jq '.body')
# Prepend blocked-by info
gh issue edit <number> --repo ilarinie/pensieve \
  --body "**Blocked by:** #<blocking-number>

$BODY"
```

### 6. Add parent issue to project board

```bash
# Add to project
ITEM_ID=$(gh api graphql -f query='
  mutation {
    addProjectV2ItemById(input: {
      projectId: "PVT_kwHOAHTkk84BPpUQ"
      contentId: "<parent issue node ID>"
    }) {
      item { id }
    }
  }
' --jq '.data.addProjectV2ItemById.item.id')

# Set status to Todo
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PVT_kwHOAHTkk84BPpUQ"
      itemId: "'"$ITEM_ID"'"
      fieldId: "PVTSSF_lAHOAHTkk84BPpUQzg9_rzQ"
      value: { singleSelectOptionId: "2eec6910" }
    }) {
      projectV2Item { id }
    }
  }
'
```

### 7. Print summary

Print a table showing what was created:

```
Created issues for: <feature name>

Parent: #<N> - <feature title>

| # | Layer | Slug | Title | Depends on | Labels |
|---|-------|------|-------|------------|--------|
| #<N> | L0 | store-memory | Store memory service | — | layer:0, claude:implement |
| #<N> | L1 | embedding-queue | Embedding queue | #<M> (store-memory) | layer:1, claude:implement |
...

All issues added to project board in "Todo" status.
Next: Run `/implement <number>` to start implementing, or add the `claude:implement` label.
```

## Allowed tools

Read, Grep, Glob, Bash

## Important

- Do NOT implement any code — only create issues
- Do NOT create branches — those are created during `/implement`
- If a GraphQL mutation fails, report the error and continue with remaining items
- Always use `--repo ilarinie/pensieve` with gh commands
