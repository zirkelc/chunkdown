#!/bin/sh
# Runs every gate in order, one line of output per gate.
#
#   sh perf/gates.sh            cheap gates, before every experiment commit
#   sh perf/gates.sh --full     also build, typecheck and format check, before a keep is final
set -e
cd "$(git rev-parse --show-toplevel)"
FULL=${1:-}

step() {
  printf '%-14s' "$1"
  shift
  if out=$("$@" 2>&1); then
    echo "ok"
  else
    echo "FAILED"
    echo "$out" | tail -40
    exit 1
  fi
}

# Tests and the harness both load `src/` directly, so there is no artifact to regenerate first.
step guard pnpm exec tsx perf/guard.mts
step tests pnpm exec vitest run
step lint pnpm lint:ci

[ "$FULL" = "--full" ] || exit 0

step build pnpm build
step typecheck pnpm exec tsc --noEmit
# The base already fails a repo-wide format check, so check only the sources this branch changed.
changed=$(git diff --name-only origin/main -- 'src/*.ts' | while read -r f; do [ -f "$f" ] && echo "$f"; done)
[ -z "$changed" ] || step format pnpm exec oxfmt --check $changed
if [ -f dist/index.js ]; then
  raw=$(wc -c < dist/index.js)
  gz=$(gzip -9 -c dist/index.js | wc -c)
  printf '%-14s%s raw, %s gzip\n' size "$raw" "$gz"
fi
