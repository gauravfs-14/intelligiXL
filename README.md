# IntelligiXL

[![CI](https://github.com/gauravfs-14/intelligiXL/actions/workflows/ci.yml/badge.svg)](https://github.com/gauravfs-14/intelligiXL/actions/workflows/ci.yml)

Local AI annotation workbench by [Gaurab Chhetri](https://gaurabchhetri.com.np).
Source-available under [PolyForm Noncommercial 1.0.0](LICENSE), with required
[attribution](NOTICE). Commercial use requires separate permission.

A spreadsheet workbench that answers questions about each row using AI models. Import a dataset, define a **Smart Column** (a question plus the possible answers), and a System One model labels every row with a probability for each answer and a confidence score. Low-confidence rows go to a human review queue.

Supported models: [Jev](https://docs.typesafe.ai) (hosted by TypeSafe) and [Laya](https://github.com/NandhaKishorM/laya) (open weights, self-hosted).

## Features

- Import CSV, XLSX, JSON and JSONL, with type inference and a preview before you confirm.
- Virtualized data grid: sort, filter, search, resize, reorder, pin, and edit cells. Row and column edits can be undone.
- Smart Columns of three types: Yes/No, Category (2–255 options) and Rating (2–10 ordered levels).
- Model choice, review threshold, concurrency, timeout and retries, set per column.
- Preview on 10 rows before running the whole dataset. Generation runs in the background, with progress, cancel, retry-failed-rows and a run log.
- A review queue that shows rows below each column's threshold. Human corrections are stored alongside the model's answer and never replace it.
- Insights: label distributions, confidence histograms and cross-tabs.
- Versioning (every edit creates a new version), templates, and export to CSV/XLSX plus a JSON file of each column's configuration.
- A Settings page for API keys, with confirmation dialogs on every delete.

## Quick start

Requirements: Node 22.12+ or Node 24+, pnpm (`corepack enable`), Docker.

```bash
make setup      # install deps, create .env, start Postgres + Redis, migrate, seed
make dev        # web on http://localhost:3000 + worker; Ctrl-C stops both
```

Then:

1. Open **Settings** and paste your TypeSafe API key (from [console.typesafe.ai](https://console.typesafe.ai)), or connect a Laya server.
2. Upload `samples/sample_crashes.csv`, or your own file.
3. Click **Add Smart Column**.

To run everything in Docker instead:

```bash
make docker-up  # Postgres, Redis, app and worker in containers, on :3000
```

## Commands

| Command | What it does |
|---|---|
| `make setup` | First-time setup. Safe to re-run. |
| `make dev` | Dev server and worker together. |
| `make web` / `make worker` | Only one of the two. |
| `make start` | Production build, then serve + worker on the host. |
| `make docker-up` / `docker-down` / `docker-logs` | Full stack in Docker. |
| `make laya` | Run Laya in Docker on `:8000` (CPU). |
| `make infra-up` / `infra-down` | Only Postgres + Redis. |
| `make db-migrate` / `db-deploy` / `db-seed` / `db-studio` | Prisma tasks. |
| `make lint` / `typecheck` / `build` | Checks and build. |

`make` with no target lists them all. The shell scripts behind them are in `scripts/`.

The worker must be running for full-column generation. Without it, jobs stay queued. Previews work without it.

## Configuration

Local settings live in `.env`, created from `.env.example`. API keys can go in `.env` or on the Settings page. Env vars take precedence, and saved keys are encrypted.

| Variable | Default |
|---|---|
| `DATABASE_URL` | local Docker Postgres |
| `REDIS_URL` | `redis://localhost:6379` |
| `LOCAL_STORAGE_DIR` | `.data/storage` |
| `APP_SECRET` | generated into `.data/app-secret` |
| `TYPESAFE_API_KEY` | — (or Settings page) |
| `LAYA_BASE_URL`, `LAYA_API_KEY` | — (or Settings page) |

Details: [docs/configuration.md](docs/configuration.md).

## Security

There is **no authentication**. Anyone who can reach the app can read your data, spend your API credits and change the settings. Run it locally, or put an authenticating proxy in front of it before exposing it.

Host start commands and Docker-published ports bind to `127.0.0.1` by default.
Uploads are limited to 20 MiB. Jev sends selected row fields to TypeSafe's hosted
service; Laya sends them to the server you configure. Use only datasets you are
permitted to share with that provider.

Confidence measures the concentration of a model's output distribution. It is
not a validated probability that a label is correct. A confident wrong label
can bypass a review threshold; evaluate on representative labeled examples.

## Documentation

- [docs/configuration.md](docs/configuration.md): environment variables, the Settings page, secret encryption
- [docs/models.md](docs/models.md): Jev and Laya, model IDs, confidence, review thresholds, run settings
- [docs/deployment.md](docs/deployment.md): Docker Compose, running on a host, volumes, backups, updating
- [docs/architecture.md](docs/architecture.md): processes, request flow, data model, code layout
- [docs/testing.md](docs/testing.md): unit checks and the API/worker integration workflow

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 7 + PostgreSQL, BullMQ + Redis, TanStack Table/Query, Radix UI, and `@typesafe-ai/sdk` for both providers.

## Limitations

- Single user and no auth. A seeded local user owns everything.
- Files are stored on local disk. S3 needs an implementation of `StorageAdapter` (`src/lib/storage`).
- The grid loads a whole dataset into the browser. It's intended for up to about 10k rows.

## License and attribution

Copyright (c) 2026 Gaurab Chhetri. Noncommercial use, modification, and
redistribution are permitted under [PolyForm Noncommercial 1.0.0](LICENSE).
Redistributed copies must retain the `Required Notice:` attribution lines in
[NOTICE](NOTICE) and the license terms or their URL. For commercial or business
use outside the license's permitted purposes, contact
[contact@gaurabchhetri.com.np](mailto:contact@gaurabchhetri.com.np).

This is a source-available noncommercial license, not an OSI-approved open-source
license. Third-party components, datasets, and models retain their own licenses.
