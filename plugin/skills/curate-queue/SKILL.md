---
name: curate-queue
description: Show the curator review queue (CURATED obligations flagged needs_review)
---

# Curator: Review Queue

Show obligations that need curator review and let the user pick one to act on.

## Instructions

1. Run the curator CLI to fetch the queue:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/../packages/curate-cli/dist/bundle.cjs obligations list
   ```

   If the user passes a profile in `$ARGUMENTS`, append `--profile <name>`.

2. If the call fails with "Not logged in" or "not a curator", instruct the user to run:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/../packages/curate-cli/dist/bundle.cjs login --key lx_... --url <LEXIUS_API_URL>
   ```

3. Render the queue as a numbered list with id, row_version, stale_since, and the first 80 chars of the obligation.

4. Ask the user which obligation they want to act on, then offer:
   - View full history → run `/lexius:curate-history <id>`
   - Edit fields → run `/lexius:curate-edit <id>`
   - Deprecate → confirm reason, then run `lexius-curate obligations deprecate <id> --row-version <rv> --reason "<r>" --apply`
