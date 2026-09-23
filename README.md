# IntelligiXL

Import a dataset, ask questions of it in plain English, and let [Jev](https://docs.typesafe.ai) (via [TypeSafe AI](https://typesafe.ai)) turn those questions into probabilistic **Smart Columns** — with full confidence scores, human review, and export.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript
- **Tailwind CSS v4** — custom "instrument panel" design system (sharp corners, one accent color, no gradients, hard-offset shadows), see [`src/app/globals.css`](src/app/globals.css)
- **PostgreSQL** via Prisma ORM 7 (driver adapters, `@prisma/adapter-pg`)
- **Redis** + **BullMQ** for the Smart Column generation job queue
- **Jev** via `@typesafe-ai/sdk`, behind a provider-agnostic `DecisionModel` interface (`src/lib/decision-models`) so swapping providers later doesn't touch call sites
- **TanStack Table v8 + Virtual** for the virtualized data grid, **TanStack Query** for client data fetching
- **Radix UI** primitives + **motion** (Framer Motion) for the component layer and animation
- **Recharts** for Insights charts, **Papaparse** / **xlsx** for import/export

Auth is intentionally out of scope for this build — see [project decision](#notes) below. There's a single seeded local user so ownership/reviewer fields still carry meaningful provenance.

## Setup

1. **Start Postgres + Redis:**

   ```bash
   docker compose up -d
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure environment:** copy `.env.example` to `.env` (already done in this checkout) and set `TYPESAFE_API_KEY` — get one at [console.typesafe.ai](https://console.typesafe.ai). Without a key, the app still runs fully: previews and generation will show a graceful "invalid API key" failure state per row instead of crashing.

4. **Run migrations + seed** (creates the local user, a default workspace, and the built-in Smart Column recipes):

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **Run the app** (two processes — the web server and the background worker that actually calls Jev):

   ```bash
   pnpm dev      # http://localhost:3000
   pnpm worker   # in a second terminal
   ```

Other useful scripts: `pnpm db:studio` (Prisma Studio), `pnpm build` / `pnpm start` (production).

## How it's organized

```
prisma/schema.prisma        Full data model — see file for inline notes
src/app/api/                REST-ish route handlers, one per resource
src/app/w/[workspaceId]/    Data / Insights / Review / Templates sections
src/lib/decision-models/    The Jev adapter + normalized response types
src/lib/parsing/            CSV/XLSX/JSON/JSONL import + type inference
src/lib/smart-columns/      Shared preview + background-generation logic
src/lib/insights/           Client-side aggregation (distributions, crosstabs)
src/components/data-grid/   The virtualized grid, filters, column menus
src/components/smart-column-builder/   The 6-step Smart Column wizard
scripts/worker.ts           BullMQ worker process entry point
```

**Data flow:** the Data/Insights/Review pages all read from one endpoint per dataset (`GET /api/datasets/:id/workbench`) that returns every row, Smart Column, and prediction at once. At the SRS's target scale (≤10k rows, ≤100 columns) this is simpler and faster than re-deriving filter/sort state on the server for three different screens, and keeps all three views reading one consistent snapshot. Generation itself runs in the background worker (BullMQ), polled by the client for progress.

## What's built vs. stubbed

Per the agreed scope, this covers the full MVP definition of done (§20 of the spec) plus templates, versioning, an "Ask IntelligiXL" router, and research telemetry:

- ✅ Dataset upload (CSV/XLSX/JSON/JSONL) with validation, type inference, and a confirm-before-import preview
- ✅ Virtualized data grid: sort, filter (search, per-column, per-Smart-Column label + confidence), column show/hide/resize/reorder, row selection, text expansion
- ✅ Binary / Categorical / Rating Smart Columns, full 6-step builder with live preview before committing
- ✅ Background generation via BullMQ with per-row fault isolation, progress, cancel, and scoped retry-failed-rows
- ✅ Probability distributions, confidence, and model provenance on every prediction
- ✅ Review Queue (confidence-based, confirm/correct/skip, original prediction always preserved)
- ✅ Insights (distributions, confidence histograms) and Compare Columns (cross-tabulation)
- ✅ Smart Column versioning (edits create a new version) + version comparison endpoint
- ✅ Templates: 6 built-in recipes + save-your-own
- ✅ Export to CSV/XLSX with selectable fields, plus reproducibility JSON per Smart Column
- ✅ "Ask IntelligiXL" — a lightweight Jev-powered router between existing columns and "you need a new one"
- ✅ Study telemetry events (structured only — payloads are size-capped to keep raw dataset text out)

Not built: authentication (by request), a real S3 storage backend (there's a one-file swap seam at `src/lib/storage`), and drag-and-drop column reordering uses a native HTML5 drag rather than a dedicated DnD library.

## Notes

- **No auth.** The user explicitly asked to skip it for this build. `src/lib/current-user.ts` has the one seam if it's added later.
- **Local file storage.** Uploaded datasets and generated files live under `.data/storage/` (gitignored). `src/lib/storage/index.ts` is the single place to swap in an S3-compatible client for production.
