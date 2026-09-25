# Architecture

## Processes

| Process | Command | Role |
|---|---|---|
| Web | `next dev` / `next start` | UI and REST API (`src/app/api`). Runs previews synchronously. |
| Worker | `tsx scripts/worker.ts` | Takes generation jobs off the Redis queue and calls the model for every row. |
| PostgreSQL | Docker | All data: datasets, rows, Smart Columns, predictions, reviews, jobs, settings. |
| Redis | Docker | BullMQ queue `smart-column-generation`. |
| laya-serve | Docker or Python (optional) | Self-hosted Laya model server. |

The worker is required for full-column generation. Without it, jobs stay `QUEUED`. Previews don't need it.

## Request flow

**Import.** Uploads go to `POST /api/uploads`, which parses the file, infers column types, and returns a preview. The file is stored under `LOCAL_STORAGE_DIR`. `POST /api/datasets` confirms the import and writes the rows to Postgres.

**Preview.** The builder calls `POST /api/smart-columns/preview` with an unsaved configuration. The web process runs it on a sample (10 random rows or the first 10) and returns the results without saving anything.

**Generate.**

1. `POST /api/smart-columns` creates the Smart Column and its version 1.
2. `POST /api/smart-columns/:id/generate` creates a `Job` row and enqueues it.
3. The worker runs `runGenerationJob` (`src/lib/smart-columns/generate.ts`) with the version's concurrency, skips rows that already succeeded, and writes one `Prediction` per row.
4. It records progress and a run log on the `Job` row. The UI polls it, and the Jobs panel shows the log.

**Read.** The Data, Insights and Review pages all read `GET /api/datasets/:id/workbench`, which returns the rows, Smart Columns and predictions for a dataset in one response. Filtering and aggregation happen on the client. That's intended for datasets up to about 10k rows.

## Data model

Defined in [`prisma/schema.prisma`](../prisma/schema.prisma).

- **SmartColumn → SmartColumnVersion.** Editing a column creates a new version and never modifies the old one in place. Each version stores the question, labels, source columns, model and run settings.
- **Prediction** is keyed by `(row, version)`. It holds the label, confidence, full probability distribution, and the model version that answered.
- **Review** is stored next to a prediction and never overwrites it. The model's original answer is always kept.
- **Job** holds progress counts and a ring buffer of the last 300 log lines.
- **DatasetChangeLog** records manual edits (cells, rows, columns) for undo/redo.
- **AppSetting** holds values saved on the Settings page (see [configuration.md](configuration.md)).

## Model providers

`src/lib/decision-models/`:

- `catalog.ts`: model list, run-setting defaults and limits, `isLowConfidence`. Imported by both client and server code.
- `system-one.ts`: a provider factory for any `/v1/systemone` server. Handles error mapping and confidence normalization.
- `jev.ts` and `laya.ts`: the two providers.
- `index.ts`: `getDecisionModel(provider)`.

Adding a provider that speaks the same protocol takes a catalog entry and a few lines calling `createSystemOneModel`. A provider with a different protocol needs its own implementation of the `DecisionModel` interface (`types.ts`).

## Directory map

```
prisma/                      schema, migrations, seed (local user, default workspace, recipes)
scripts/                     worker entry point, setup/dev/start scripts
docker/                      container entrypoint, Laya image
samples/                     example dataset
src/app/api/                 REST handlers, one directory per resource
src/app/w/[workspaceId]/     Overview, Data, Insights, Review, Templates, Settings
src/components/data-grid/    virtualized grid, filters, column menus
src/components/smart-column-builder/   the 7-step builder
src/lib/decision-models/     providers and model catalog
src/lib/settings/            settings store, encryption, connection checks
src/lib/smart-columns/       preview, generation, per-row execution
src/lib/parsing/             CSV/XLSX/JSON/JSONL import and type inference
src/lib/storage/             file storage (local disk; swap in S3 here)
```
