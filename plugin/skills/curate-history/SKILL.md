---
description: Show audit history for a specific obligation
---

# Curator: Obligation History

Show the full edit history for an obligation: who changed what, when, and why.

## Instructions

The obligation id is in `$ARGUMENTS`. If empty, ask for it.

1. Run:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/../packages/curate-cli/dist/bundle.cjs obligations history <id>
   ```

2. Render the result as a table: timestamp, action, version transition (`vN→vN+1`), editor, and reason.

3. If the user wants to revert one of the listed edits, capture the edit id and run:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/../packages/curate-cli/dist/bundle.cjs revert <editId> --reason "<reason>"
   ```

   Show the dry-run output and confirm before re-running with `--apply`.
