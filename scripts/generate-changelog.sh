#!/bin/bash
# Generates a changelog section from git commits since the last tag.
# Groups by conventional commit prefix (feat/fix/docs/ci/chore).
# Output goes to stdout — pipe to CHANGELOG.md or review first.
#
# Usage:
#   ./scripts/generate-changelog.sh              # since last tag
#   ./scripts/generate-changelog.sh v0.3.0       # since specific tag

SINCE=${1:-$(git describe --tags --abbrev=0 2>/dev/null)}

if [ -z "$SINCE" ]; then
  echo "No previous tag found. Showing last 50 commits."
  RANGE="HEAD~50..HEAD"
else
  RANGE="${SINCE}..HEAD"
  echo "# Changes since ${SINCE}" >&2
fi

FEATS=$(git log "$RANGE" --pretty="- %s" --no-merges --grep="^feat" --extended-regexp 2>/dev/null)
FIXES=$(git log "$RANGE" --pretty="- %s" --no-merges --grep="^fix" --extended-regexp 2>/dev/null)
DOCS=$(git log "$RANGE" --pretty="- %s" --no-merges --grep="^docs" --extended-regexp 2>/dev/null)
CI=$(git log "$RANGE" --pretty="- %s" --no-merges --grep="^ci" --extended-regexp 2>/dev/null)
CHORE=$(git log "$RANGE" --pretty="- %s" --no-merges --grep="^chore" --extended-regexp 2>/dev/null)

echo "## [Unreleased]"
echo ""

if [ -n "$FEATS" ]; then
  echo "### Added"
  echo "$FEATS"
  echo ""
fi

if [ -n "$FIXES" ]; then
  echo "### Fixed"
  echo "$FIXES"
  echo ""
fi

if [ -n "$DOCS" ]; then
  echo "### Documentation"
  echo "$DOCS"
  echo ""
fi

if [ -n "$CI" ]; then
  echo "### CI/CD"
  echo "$CI"
  echo ""
fi

if [ -n "$CHORE" ]; then
  echo "### Maintenance"
  echo "$CHORE"
  echo ""
fi
