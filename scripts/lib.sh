# shellcheck shell=bash
# Shared helpers for scripts/*.sh. Source it, don't execute it.
# Compatible with macOS bash 3.2 and Linux bash 4+/5+.

# Always operate from the repo root, regardless of where the script was called from.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

export PRISMA_HIDE_UPDATE_MESSAGE=1

# shellcheck disable=SC2034  # colors are used by the scripts that source this file
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'; C_MAGENTA=$'\033[35m'; C_CYAN=$'\033[36m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""
  C_BLUE=""; C_MAGENTA=""; C_CYAN=""
fi

step() { printf '\n%s==>%s %s%s%s\n' "$C_BLUE" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"; }
ok()   { printf '    %sok%s  %s\n' "$C_GREEN" "$C_RESET" "$*"; }
info() { printf '    %s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }
warn() { printf '    %swarn%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '\n%serror:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# --- prerequisite checks -----------------------------------------------------

check_node() {
  have node || die "Node.js is not installed. Install Node 22.12+ (22 LTS recommended): https://nodejs.org or 'brew install node@22' / nvm / fnm."
  if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 22 && minor >= 12) || major >= 24 ? 0 : 1)'; then
    die "Node $(node -v) is too old; this project needs Node 22.12+ or Node 24+."
  fi
  ok "node $(node -v)"
}

check_pnpm() {
  if ! have pnpm; then
    die "pnpm is not installed. Run 'corepack enable' (ships with Node) and re-run; corepack will use the pnpm version pinned in package.json."
  fi
  ok "pnpm $(pnpm -v)"
}

check_docker() {
  have docker || die "Docker is not installed. Install Docker Desktop (macOS) or Docker Engine + the compose plugin (Linux)."
  docker compose version >/dev/null 2>&1 || die "'docker compose' (Compose v2) is not available. Install/upgrade Docker Desktop or the docker-compose-plugin package."
  docker info >/dev/null 2>&1 || die "The Docker daemon is not running (or you lack permission). Start Docker Desktop / 'sudo systemctl start docker' and re-run."
  ok "docker $(docker version --format '{{.Server.Version}}' 2>/dev/null), $(docker compose version --short 2>/dev/null | sed 's/^/compose v/')"
}

# --- idempotent project steps ------------------------------------------------

ensure_env_file() {
  if [ -f .env ]; then
    ok ".env exists (left untouched)"
  elif [ -f .env.example ]; then
    cp .env.example .env
    ok "created .env from .env.example (edit it to add API keys, or use the in-app Settings page)"
  else
    die ".env.example is missing; cannot create .env."
  fi
}

ensure_deps() {
  if [ -d node_modules ] && [ -f node_modules/.modules.yaml ]; then
    ok "node_modules present (run 'pnpm install' after pulling dependency changes)"
  else
    info "node_modules missing; running pnpm install"
    pnpm install --frozen-lockfile || die "pnpm install failed (if the lockfile is out of date, run 'pnpm install' manually)."
  fi
  if [ ! -d src/generated/prisma ]; then
    info "Prisma client not generated; running prisma generate"
    pnpm db:generate || die "prisma generate failed."
  fi
}

infra_up() {
  docker compose up -d --wait postgres redis \
    || die "Could not start postgres/redis. Check 'docker compose logs postgres redis'. If ports 5432/6379 are taken, set POSTGRES_PORT/REDIS_PORT and update DATABASE_URL/REDIS_URL in .env."
  ok "postgres and redis are healthy"
}

db_deploy() {
  pnpm -s db:deploy || die "prisma migrate deploy failed. Is DATABASE_URL in .env pointing at the running postgres?"
  ok "migrations applied"
}

# --- run two long-lived processes together -----------------------------------
#
# run_together NAME1 COLOR1 "CMD1" NAME2 COLOR2 "CMD2"
#
# Starts both commands, each in its own process group (set -m), with output
# prefixed by [NAME]. When either exits, or on Ctrl-C / SIGTERM, both process
# groups are sent SIGTERM (then SIGKILL after a grace period). Returns the exit
# code of the first process to exit (130 on Ctrl-C).

_rt_pids=""
_rt_cleaning=0

_prefix() {
  # $1 = label, $2 = color
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    printf '%s[%s]%s %s\n' "$2" "$1" "$C_RESET" "$line"
  done
}

_rt_alive() {
  local p
  for p in $_rt_pids; do
    kill -0 "$p" 2>/dev/null && return 0
  done
  return 1
}

_rt_cleanup() {
  [ "$_rt_cleaning" -eq 1 ] && return
  _rt_cleaning=1
  local p i
  printf '\n%s==>%s stopping...\n' "$C_BLUE" "$C_RESET"
  for p in $_rt_pids; do
    kill -TERM -- "-$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null || true
  done
  i=0
  while _rt_alive && [ "$i" -lt 100 ]; do
    sleep 0.1; i=$((i + 1))
  done
  for p in $_rt_pids; do
    kill -KILL -- "-$p" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

run_together() {
  local n1="$1" c1="$2" cmd1="$3" n2="$4" c2="$5" cmd2="$6"
  local p1 p2 code=0

  trap '_rt_cleanup; exit 130' INT
  trap '_rt_cleanup; exit 143' TERM
  trap '_rt_cleanup' EXIT

  set -m   # give each background job its own process group
  bash -c "exec $cmd1" > >(_prefix "$n1" "$c1") 2>&1 &
  p1=$!
  bash -c "exec $cmd2" > >(_prefix "$n2" "$c2") 2>&1 &
  p2=$!
  set +m
  _rt_pids="$p1 $p2"

  # bash 3.2 has no `wait -n`; poll until one of them exits.
  while kill -0 "$p1" 2>/dev/null && kill -0 "$p2" 2>/dev/null; do
    sleep 1
  done
  if ! kill -0 "$p1" 2>/dev/null; then
    wait "$p1" 2>/dev/null || code=$?
    printf '%s[%s]%s exited (code %s)\n' "$c1" "$n1" "$C_RESET" "$code"
  else
    wait "$p2" 2>/dev/null || code=$?
    printf '%s[%s]%s exited (code %s)\n' "$c2" "$n2" "$C_RESET" "$code"
  fi
  _rt_cleanup
  return "$code"
}
