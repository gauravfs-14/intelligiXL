#!/bin/sh
# Container entrypoint. Roles:
#   web     apply migrations, seed (idempotent), then next start on $PORT
#   worker  run the BullMQ Smart Column worker
#   migrate apply migrations + seed, then exit
#   <cmd>   anything else is exec'd as-is (e.g. `sh`)
# Env: SKIP_MIGRATE=1, SKIP_SEED=1 to skip those steps for the web role.
set -eu

BIN=/app/node_modules/.bin
role="${1:-web}"

migrate() {
  if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
    echo "[entrypoint] prisma migrate deploy"
    "$BIN/prisma" migrate deploy
  fi
  if [ "${SKIP_SEED:-0}" != "1" ]; then
    echo "[entrypoint] seeding (idempotent)"
    "$BIN/tsx" prisma/seed.ts
  fi
}

case "$role" in
  web)
    migrate
    echo "[entrypoint] starting next on 0.0.0.0:${PORT:-3000}"
    exec "$BIN/next" start -p "${PORT:-3000}" -H 0.0.0.0
    ;;
  worker)
    echo "[entrypoint] starting worker"
    exec "$BIN/tsx" scripts/worker.ts
    ;;
  migrate)
    migrate
    ;;
  *)
    exec "$@"
    ;;
esac
