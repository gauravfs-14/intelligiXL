#!/usr/bin/env bash
# One-time (and safe-to-rerun) local setup: prerequisites, deps, .env,
# postgres + redis, Prisma client, migrations, seed data.
set -euo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

step "Checking prerequisites"
check_node
check_pnpm
check_docker

step "Environment file"
# Before install: the postinstall hook runs `prisma generate`, which loads prisma.config.ts.
ensure_env_file

step "Installing dependencies (pnpm install)"
pnpm install --frozen-lockfile || die "pnpm install failed. If package.json changed without a lockfile update, run 'pnpm install' and commit pnpm-lock.yaml."
ok "dependencies installed"

step "Starting postgres and redis (docker compose)"
infra_up

step "Generating Prisma client"
pnpm -s db:generate || die "prisma generate failed."
ok "Prisma client generated in src/generated/prisma"

step "Applying database migrations"
db_deploy

step "Seeding database (idempotent)"
pnpm -s db:seed || die "Seeding failed. Check DATABASE_URL in .env."
ok "seed complete"

printf '\n%sSetup complete.%s Next step:\n\n    make dev        %s# or: scripts/dev.sh  (web on http://localhost:%s + worker)%s\n\n' \
  "$C_GREEN$C_BOLD" "$C_RESET" "$C_DIM" "${PORT:-3000}" "$C_RESET"
