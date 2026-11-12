# Models

IntelligiXL runs every Smart Column through a **System One** decision model: the model gets the row's source columns plus a typed question and returns a label, a probability for every option, and a confidence score. It never generates free text.

Two providers are supported. Both speak the same wire protocol (`POST /v1/systemone`), so the app uses the TypeSafe SDK for both.

| Provider | Hosting | Configure with | Notes |
|---|---|---|---|
| **Jev** (TypeSafe) | Hosted at `api.typesafe.ai` | `TYPESAFE_API_KEY` | Default. Per-token pricing. |
| **Laya** | Self-hosted `laya-serve` | `LAYA_BASE_URL`, optional `LAYA_API_KEY` | Open weights, runs on CPU or GPU. |

You can set both on the **Settings** page or as environment variables. See [configuration.md](configuration.md).

## Model IDs

Each Smart Column version stores `modelProvider` and `modelIdentifier`.

| Provider | `modelIdentifier` | Sent to the server as | Use |
|---|---|---|---|
| `typesafe` | `jev-latest` | `jev-latest` | Latest stable Jev. Default. |
| `typesafe` | `jev-preview` | `jev-preview` | Newest build, including previews. |
| `typesafe` | `jev-1.13.0` | `jev-1.13.0` | Pinned version. Use this when you need results that don't change between runs over time. |
| `laya` | `laya-auto` | `convaiinnovations/laya` | Laya's router picks English or multilingual per row. |
| `laya` | `laya-english` | `english` | ModernBERT-large, 421M params, 512-token context. |
| `laya` | `laya-multilingual` | `multilingual` | mmBERT-base, 322M params, 100+ languages. |
| `laya` | `laya-typed-decisions` | `typed-decisions` | Fine-tuned for triage/routing/moderation. |

The catalog lives in [`src/lib/decision-models/catalog.ts`](../src/lib/decision-models/catalog.ts). `GET /api/models` returns it with an `available` flag per model, which the builder uses to enable or disable choices.

## Question types

| Smart Column type | Sent as | Result |
|---|---|---|
| Yes / No | `choice` with options `yes`, `no` | label + probability per option |
| Category | `choice` with your options (2–255) | label + probability per option |
| Rating | `score` with ordered levels (2–10) | nearest level, expected score, probability per level |

Option and level descriptions are sent as criteria. They are optional, but they improve accuracy.

## Confidence and review thresholds

- Confidence is a measure of how concentrated the probability distribution is: `(n · p_max − 1) / (n − 1)`, clamped to [0, 1]. This is TypeSafe's definition.
- Laya reports its own confidence differently (1 − normalized entropy). IntelligiXL ignores Laya's value and recomputes confidence from its probabilities using the formula above, so a threshold means the same thing on both providers.
- Each Smart Column has a **review threshold**, 80% by default. Predictions below it are flagged in the grid, counted on the dashboard, and shown first in the Review queue. You can set the review mode to "Just record it" to turn flagging off.

Concentration is not the probability that an answer is correct. IntelligiXL has
not established calibration for your dataset, prompt, or provider. Confident
errors can escape threshold-based review. Measure accuracy and calibration on
representative labeled data before choosing a cutoff. Matching the confidence
formula across providers does not establish equal empirical error rates.

## Run settings

These are set per Smart Column in the builder's **Model & tuning** step, and stored on the version (`SmartColumnVersion.settings`).

| Setting | Default | Range | Effect |
|---|---|---|---|
| `confidenceThreshold` | 0.80 | 0.50–0.99 | Review cutoff (see above). |
| `lowConfidenceAction` | `flag` | `flag`, `none` | Whether low-confidence rows are flagged. |
| `concurrency` | 6 | 1–16 | Parallel requests during a full run. |
| `timeoutMs` | 10000 | 2000–60000 | Per-attempt request timeout. |
| `maxRetries` | 2 | 0–5 | Retries on timeouts, 429s and 5xx errors. |

When you edit a Smart Column, it keeps its model and settings unless you change them. Every edit creates a new version, so each past prediction stays tied to the exact configuration that produced it.

## Running Laya

Laya is optional. Pick one:

```bash
make laya                                   # Docker, CPU, serves on :8000
```

```bash
pip install "laya[serve]"                   # Python 3.10+
LAYA_PORT=8000 laya-serve
```

Then set the server URL to `http://localhost:8000` on the Settings page. With `make docker-up`, the app reaches the Laya container at `http://laya:8000`.

Behavior worth knowing:

- Checkpoints download from Hugging Face the first time each one is used. That's roughly 1–2 GB each and can take a minute or more on CPU, so raise the timeout under Advanced for the first run.
- `laya-serve` handles one request at a time. Raising concurrency above 1 queues requests on the server instead of speeding things up.
- Laya fits every option into one fixed token window. Past roughly 20 options with descriptions, it shortens the option text. The builder shows a warning in that case. With far more options, rows fail with a 422 error.
- Every Rating level needs a description. IntelligiXL always sends the level text, so this never fails.
