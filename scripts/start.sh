#!/usr/bin/env bash
# Production (on the host): build, apply migrations, then run `next start`
# and the worker together. Ctrl-C stops both.
#   PORT=3000 scripts/start.sh          # SKIP_BUILD=1 to reuse an existing .next build
set -euo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

export PORT="${PORT:-3000}"
export NODE_ENV=production

step "Preparing production run"
check_node
check_pnpm
ensure_env_file
ensure_deps
db_deploy

if [ "${SKIP_BUILD:-0}" = "1" ] && [ -f .next/BUILD_ID ]; then
  ok "SKIP_BUILD=1: reusing existing .next build"
else
  step "Building (next build)"
  pnpm -s build || die "next build failed."
fi

step "Starting web (http://localhost:$PORT) and worker — Ctrl-C to stop"
run_together web "$C_CYAN" "pnpm -s start --port $PORT" \
             worker "$C_MAGENTA" "pnpm -s worker:start"
