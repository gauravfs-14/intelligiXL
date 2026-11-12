# Verification

Use Node 22.12+ or Node 24+, and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
pnpm typecheck
pnpm audit --prod --audit-level=high
```

## Integration workflow

The integration suite exercises CSV upload and confirmation, preview without
persisting predictions, the real BullMQ worker, failed-row retries, cancellation,
human correction provenance, and XLSX export/read-back. PostgreSQL, Redis, the
route handlers, storage, and serialization are real. Inference alone uses a
deterministic fixture, so tests require no API key, network model, or paid calls.
These are API and worker integration tests, not browser automation or a model
accuracy evaluation.

Start dedicated disposable services. These do not use development data volumes:

```sh
docker compose -p intelligixl-release-test -f docker-compose.test.yml up -d --wait
export DATABASE_URL=postgresql://intelligixl:intelligixl@127.0.0.1:55439/intelligixl_test
export REDIS_URL=redis://127.0.0.1:56389/15
export LOCAL_STORAGE_DIR=/tmp/intelligixl-test/storage
pnpm db:deploy
pnpm test:integration
docker compose -p intelligixl-release-test -f docker-compose.test.yml down
```

The suite refuses a database name without the `_test` suffix, Redis database
other than 15, or storage path without `intelligixl-test`. It creates and removes
its own workspace. Use a dedicated Redis instance: the suite clears the Smart
Column queue in database 15. Never point these variables at real user data.

CI runs these checks on pushes and pull requests. Live provider compatibility
and model quality must still be checked with the provider you intend to use.
