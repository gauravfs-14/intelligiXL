#!/usr/bin/env bash
# Development: ensure infra + migrations, then run `next dev` and the
# watch-mode worker together. Ctrl-C stops both.
#   PORT=3100 scripts/dev.sh
set -euo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

export PORT="${PORT:-3000}"

step "Preparing development environment"
check_node
check_pnpm
check_docker
ensure_env_file
ensure_deps
infra_up
db_deploy

step "Starting web (http://localhost:$PORT) and worker — Ctrl-C to stop"
run_together web "$C_CYAN" "pnpm -s dev --port $PORT" \
             worker "$C_MAGENTA" "pnpm -s worker"
