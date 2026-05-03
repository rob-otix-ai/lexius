# Lexius Claude Code Plugin

Bundles the Lexius MCP server, legislation-agnostic skills, curator workflow commands, and a compliance-reviewer sub-agent into a single Claude Code plugin.

## What's inside

| Surface | Items |
|---|---|
| MCP server | `lexius` — 13 tools (classify, obligations, penalty, articles, search, swarm assessment, derivation chains, …) |
| Skills (`/lexius:*`) | `classify`, `compliance`, `penalty`, `search` |
| Curator commands (`/lexius:*`) | `curate-queue`, `curate-edit`, `curate-history`, `curate-my-edits` |
| Sub-agent | `lexius-compliance-reviewer` — end-to-end regulatory assessment |

## Prerequisites

Build the bundled binaries the plugin invokes:

```bash
pnpm plugin:build
```

Then either set up your own backend, or use the one-liner local development setup:

```bash
# For development: brings up DB, API, seeds EU AI Act, mints and caches a key
pnpm dev:stack

# Load extra legislations on demand:
#   --with eu-ai-act | dora | cima-aml | cima-vasp | ... (any registered id)
#   --with eu        (all EU regs)
#   --with cima      (all 10 CIMA acts)
#   --with all       (everything)
# Repeatable: pnpm dev:stack --with cima --with dora

# For production: point at your hosted Lexius instance
export LEXIUS_API_URL=https://your-lexius-instance.example.com
export LEXIUS_API_KEY=lx_...
```

## Install

From this repo root:

```bash
claude --plugin-dir ./plugin
```

Or, from inside Claude Code:

```
/plugin install ./plugin
```

After install, run `/reload-plugins` to pick up future edits without restarting.

## Verify

Inside a Claude Code session:

- `/help` should list `/lexius:classify`, `/lexius:curate-queue`, etc.
- `/agents` should list `lexius-compliance-reviewer`.
- The `lexius` MCP server should appear in `/mcp` with tools prefixed `mcp__lexius__legalai_*`.

## Curator commands

The curator commands shell out to the `lexius-curate` CLI bundled at `packages/curate-cli/dist/bundle.cjs`. Log in once before using them:

```bash
node packages/curate-cli/dist/bundle.cjs login \
  --key lx_curator_key... \
  --url $LEXIUS_API_URL
```

Edit/deprecate/revert flows always dry-run first and require explicit confirmation before re-running with `--apply`.
