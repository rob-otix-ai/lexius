---
name: curate-edit
description: Guided edit flow for a CURATED obligation (dry-run first, then apply)
---

# Curator: Edit Obligation

Walk the user through editing an obligation safely: fetch current state, propose changes, dry-run, then apply on confirmation.

## Instructions

The obligation id is in `$ARGUMENTS`. If empty, ask for it (or suggest running `/lexius:curate-queue`).

1. Fetch current state and history so you know the latest `row_version`:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/../packages/curate-cli/dist/bundle.cjs obligations history <id>
   ```

2. Ask the user which fields to change (obligation text, deadline, category, details, derivedFrom). Build a JSON object of changes, e.g. `{"obligation": "new text", "category": "transparency"}`.

3. Ask for an audit reason — required by the API. Push back if vague (e.g. "fix" → ask what was wrong).

4. **Dry-run first** (omit `--apply`):

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/../packages/curate-cli/dist/bundle.cjs obligations edit <id> \
     --row-version <rv> \
     --changes '<json>' \
     --reason "<reason>"
   ```

   Show the user the dry-run diff.

5. Confirm explicitly with the user before re-running with `--apply`. Never apply without confirmation.

6. After applying, run history once more so the user sees the new row_version land.
