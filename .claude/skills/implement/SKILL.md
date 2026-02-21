# /implement — TDD implementation of a GitHub issue

disable-model-invocation: true

## Description

Implements a single GitHub issue using TDD workflow: creates a branch, writes tests first, implements to green, runs full verification, and opens a PR.

## Usage

```
/implement <issue-number>
```

Example: `/implement 42`

## Instructions

You are implementing a single GitHub issue using strict TDD. Follow these steps.

### 1. Read the issue

```bash
gh issue view $ARGUMENTS --repo ilarinie/pensieve --json title,body,labels,number
```

Extract:

- Title and description
- Acceptance criteria (checkboxes)
- Branch name (from the issue body, or derive from title)
- Layer label (layer:0, layer:1, layer:2)

### 2. Check blockers

Look for "Blocked by" references in the issue body. For each referenced issue:

```bash
gh issue view <blocking-number> --repo ilarinie/pensieve --json state --jq '.state'
```

If any blocking issue is still OPEN, tell the user and stop:

```
Issue #<N> is blocked by #<M> (<title>) which is still open.
Implement the blocking issue first, or remove the dependency.
```

### 3. Read project context

Read these files to understand conventions:

- `CLAUDE.md` — project rules (you MUST follow all rules here)
- The parent issue (if this is a sub-issue) for overall feature context
- Any existing files listed in the issue's "Files" section

### 4. Create branch

```bash
git checkout main
git pull origin main
git checkout -b <branch-name>
```

Use the branch name from the issue body. If not specified, derive it:

- `feat/<slug>` for features
- `fix/<slug>` for bugs

### 5. TDD implementation cycle

For each file to create/modify:

**a. Write the test first**

- Create `<name>.test.ts` co-located with the source file
- Follow project test conventions: `describe/test`, vitest imports, Arrange-Act-Assert
- Tests should cover all acceptance criteria from the issue
- Run the test to verify it fails (red):

```bash
npx vitest run <test-file-path> --reporter=verbose
```

**b. Write the minimal implementation**

- Create/modify the source file
- Follow ALL code style rules: functional only, const + arrow, no semicolons, single quotes, .js imports, TSDoc on exports
- Use dependency injection (db/resources as first parameter)
- One named export per file

**c. Verify green**

```bash
npx vitest run <test-file-path> --reporter=verbose
```

**d. Refactor if needed** while keeping tests green.

### 6. Full verification

Run all checks — every one must pass:

```bash
npm run test:run
npm run typecheck
npm run lint
npm run format:check
```

If any check fails, fix the issue and re-run. Do NOT proceed with failures.

If format check fails, run `npm run format` and re-check.

### 7. Commit and push

Stage and commit following project git conventions:

```bash
git add <specific-files>
git commit --no-gpg-sign -m "<type>: <description>"
git push -u origin <branch-name>
```

Commit rules:

- **NO Co-Authored-By** or any signatures
- **NO GPG signatures** (use `--no-gpg-sign`)
- Format: `<type>: <description>` — lowercase, imperative, no period, under 72 chars
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Multiple commits are fine if the work is logically separable (e.g., one for types, one for implementation, one for tests).

### 8. Open PR

```bash
gh pr create \
  --repo ilarinie/pensieve \
  --title "<type>: <short description>" \
  --body "Closes #<issue-number>

## Summary

<Brief description of what was implemented>

## Changes

<List of files created/modified and what each does>

## Test Coverage

<Summary of tests added>

## Checklist

- [ ] Tests pass (`npm run test:run`)
- [ ] Types check (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Format check passes (`npm run format:check`)
- [ ] TSDoc on all exports
- [ ] No classes, no semicolons, single quotes
- [ ] .js extensions on relative imports
"
```

### 9. Report completion

Tell the user:

- PR URL
- What was implemented
- Test summary (how many tests, what they cover)
- Any notes or decisions made during implementation

## Allowed tools

Read, Write, Edit, Grep, Glob, Bash

## Important

- Follow ALL rules in CLAUDE.md — no exceptions
- TDD is mandatory: write tests BEFORE implementation
- Every export must have TSDoc
- Never skip verification steps
- If you encounter an unexpected situation, ask the user rather than guessing
- Do NOT modify files unrelated to the issue
- Do NOT amend existing commits — create new ones
