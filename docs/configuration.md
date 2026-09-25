# Configuration

Configuration comes from environment variables (`.env` locally) and, for provider credentials, the **Settings** page.

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | from `.env.example` | PostgreSQL connection string. |
| `REDIS_URL` | yes | `redis://localhost:6379` | Redis for the generation job queue. |
| `LOCAL_STORAGE_DIR` | no | `.data/storage` | Where uploaded datasets and exports are written. |
| `APP_SECRET` | no | auto-generated | Encryption key for secrets saved on the Settings page. See below. |
| `TYPESAFE_API_KEY` | no* | — | Jev API key. Can be set on the Settings page instead. |
| `LAYA_BASE_URL` | no | — | laya-serve URL, e.g. `http://localhost:8000`. Can be set on the Settings page. |
| `LAYA_API_KEY` | no | — | Only if laya-serve was started with `LAYA_API_KEY`. Can be set on the Settings page. |
| `PORT` | no | `3000` | Web server port for `make dev` / `make start`. |
| `DOCKER_LAYA_BASE_URL` | no | — | Docker only: the Laya URL as seen from the containers. See [deployment.md](deployment.md#container-settings). |

\* You need at least one provider (Jev or Laya) configured to generate Smart Columns. The app starts and runs without either.

`.env.example` lists all of them. `make setup` copies it to `.env` if `.env` doesn't exist, and never overwrites an existing one.

## Settings page

Open **Settings** in the sidebar (`/w/<workspaceId>/settings`). It manages:

- TypeSafe API key
- Laya server URL
- Laya API key

Rules:

- **Environment variables take precedence.** If `TYPESAFE_API_KEY` is set in the environment, the page shows it as read-only ("from environment") and won't let you overwrite it. Remove it from the environment to manage it in the UI.
- **Secrets are write-only.** The API never returns them. The page shows the last four characters only.
- **Changes apply without a restart.** The web app and the worker re-read settings at most 5 seconds after a change.
- **Test** checks the current credentials: Jev by listing models (no inference cost), Laya by calling `GET /health`.

Values are stored in the `AppSetting` table.

## Secret encryption

Secrets saved on the Settings page are encrypted with AES-256-GCM before they're written to Postgres. The key comes from:

1. `APP_SECRET`, if set (any string; it's hashed to 32 bytes), otherwise
2. `.data/app-secret`, a random key generated on first use with file mode `0600`.

The web app and the worker must use the same key. Locally they share `.data/`. In Docker, both containers mount the `intelligixl_app_data` volume, and `APP_SECRET` is passed to both.

If the key changes (for example `.data/` is deleted, or `APP_SECRET` changes), saved secrets can't be decrypted. The Settings page flags them, and you need to enter them again.

For production, set `APP_SECRET` explicitly and keep it somewhere safe:

```bash
openssl rand -base64 32
```

## Security

IntelligiXL has **no authentication**. A single local user is seeded for record-keeping (who owns a workspace, who reviewed a row). Anyone who can reach the app can read your data, run jobs that spend your API credits, and change the settings. Don't expose it to the internet without putting an authenticating reverse proxy in front of it (OAuth proxy, VPN, or IP allow-list).
