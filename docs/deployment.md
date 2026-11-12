# Deployment

Two options:

- **Docker Compose**: the full stack in containers.
- **Host**: Node on the host, with Postgres and Redis in Docker.

Read the security note in [configuration.md](configuration.md#security) first. The app has no login.

All Docker-published ports bind to `127.0.0.1`, including PostgreSQL and Redis.
Host `pnpm dev` and `pnpm start` also bind to loopback. Keep these defaults for
local use. Public or shared hosting needs an authenticating proxy and a review
of network access; the application itself does not enforce user isolation.

## Docker Compose

```bash
cp .env.example .env        # optional; set APP_SECRET, TYPESAFE_API_KEY
make docker-up              # build the image, start everything, wait until healthy
```

Open `http://localhost:3000`. To change the host port, set `APP_PORT`.

### Services

| Service | Profile | Image | Notes |
|---|---|---|---|
| `postgres` | (default) | `postgres:17-alpine` | Host port `POSTGRES_PORT` (5432). |
| `redis` | (default) | `redis:7-alpine` | Host port `REDIS_PORT` (6379). |
| `app` | `app` | `intelligixl:latest` | Runs `prisma migrate deploy`, then the seed, then `next start`. Host port `APP_PORT` (3000). |
| `worker` | `app` | `intelligixl:latest` | Generation worker. Starts once `app` is healthy, so migrations have already run. |
| `laya` | `laya` | `intelligixl-laya:latest` | Optional CPU laya-serve. Host port `LAYA_PORT` (8000). |

`app` and `worker` share one image and one `/app/.data` volume, which holds uploads, exports and `app-secret`.

### Volumes

| Volume (compose key) | Contents |
|---|---|
| `intelligixl_postgres_data` | Database |
| `intelligixl_redis_data` | Queue state |
| `intelligixl_app_data` | Uploaded files, exports, `app-secret` |
| `intelligixl_laya_models` | Laya checkpoints (Hugging Face cache) |

Docker prefixes each name with the project name, e.g. `intelligixl_intelligixl_postgres_data`. `make docker-down` stops the containers and keeps the volumes. `docker compose down -v` deletes all data.

### Container settings

- **Database and Redis URLs.** Compose sets `DATABASE_URL` and `REDIS_URL` to the `postgres` and `redis` services. The values in `.env` are ignored for these two.
- **API keys.** `TYPESAFE_API_KEY`, `LAYA_API_KEY` and `APP_SECRET` are passed through from your shell or `.env`. Leave them empty to manage keys on the Settings page instead.
- **Laya URL.** Containers deliberately ignore `LAYA_BASE_URL`, because a dev `.env` usually has a `localhost` value that doesn't work inside a container. Set the Laya URL on the Settings page, or set `DOCKER_LAYA_BASE_URL`:
  - `http://laya:8000` for the `laya` service (`make laya`)
  - `http://host.docker.internal:8000` for a laya-serve running on the host
- **Entrypoint switches.** `docker/entrypoint.sh` reads `SKIP_MIGRATE=1` and `SKIP_SEED=1`. The seed runs on every start and resets edits to built-in templates. Set `SKIP_SEED=1` to keep them.

### Updating

```bash
git pull
make docker-up              # rebuilds; app applies new migrations on start
```

### Backups

```bash
docker compose exec -T postgres pg_dump -U intelligixl intelligixl > backup.sql
```

Back up the `intelligixl_app_data` volume too, and `APP_SECRET` if you set one. Without the same key, secrets saved on the Settings page can't be decrypted.

## Host

Requirements: Node 22.12+ or Node 24+, pnpm (`corepack enable`), Docker (for Postgres and Redis).

```bash
make setup                  # install deps, create .env, start postgres+redis, migrate, seed
make start                  # next build, then next start + production worker; Ctrl-C stops both
```

Set `SKIP_BUILD=1` to reuse an existing build, and `PORT` to change the port. Put a process manager (systemd, pm2) or a container around `scripts/start.sh` if it has to survive reboots.

## Scaling notes

- Run more worker processes to process several Smart Columns at once. Each worker takes up to 3 jobs at a time, and each job runs rows in parallel according to the column's concurrency setting.
- File storage is local disk (`src/lib/storage/local.ts`). To run on several hosts, implement the `StorageAdapter` interface in `src/lib/storage/types.ts` for S3 or similar.
- The workbench endpoint loads a whole dataset into the browser. It's designed for datasets up to about 10k rows.
