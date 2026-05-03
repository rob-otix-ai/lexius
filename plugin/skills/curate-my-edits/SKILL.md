---
name: curate-my-edits
description: Show the current curator's recent edits
---

# Curator: My Edits

Show edits made by the currently logged-in curator.

## Instructions

If `$ARGUMENTS` contains an ISO timestamp, pass it as `--since`.

1. Run:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/../packages/curate-cli/dist/bundle.cjs my-edits ${ARGUMENTS:+--since "$ARGUMENTS"}
   ```

2. Render as a table: timestamp, action, entity (`obligation/<id>`), reason.

3. If the user wants to revert one of the listed edits, capture the edit id and offer to run `/lexius:curate-history <obligationId>` to inspect, then revert from there.
