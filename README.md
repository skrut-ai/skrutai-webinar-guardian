# skrutai-webinar-guardian

Monorepo demo for a bootcamp launch webinar that shows:

1. A hosted chatbot with controlled failure flags in `apps/web`
2. A standalone monitoring app for pre-ship GitHub gate status and deployment outcomes in `apps/monitoring`
3. A LangSmith-style post-ship tracing webhook that sends email when thresholds are breached

## What this demo shows

- Happy path: push passes, deploys to Vercel, no email trigger
- Pre-ship failure: a flag lowers quality metrics, GitHub Action gate fails, monitoring UI shows a gate, email is sent
- Post-ship failure: a flag is turned on after deploy, trace metrics drop below threshold, webhook triggers email

## Project layout

- `apps/web`: chatbot, landing page, and tracing demo
- `apps/monitoring`: standalone monitoring app with its own deployable surface
- `packages/skrutai-core`: shared event, metrics, store, and email helpers
- `.github/workflows/skrutai-web-gate-deploy.yml`: real pre-ship gate for the chatbot app
- `.github/workflows/skrutai-monitoring-gate-deploy.yml`: standalone monitoring gate example for GitHub Actions

## Local setup

1. Copy `.env.example` to `.env.local` if you want to configure email.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run dev
```

4. Open:
- `http://localhost:3006`
- `http://localhost:3006/chatbot`
- `http://localhost:3006/tracing`

To run the standalone monitoring app in a second terminal:

```bash
npm run dev:monitoring
```

Then open `http://localhost:3005`.

## Demo flow

### 1. Happy path

1. Keep all chatbot flags off.
2. Open the standalone monitoring app.
3. Click `Simulate GitHub push`.
4. Result should be `passed` and deployment should show `deployed`.
5. Open `Tracing`.
6. Click `Trigger trace webhook`.
7. Result should stay `healthy` and no email should be triggered.

### 2. Pre-ship failure

1. Open `Chatbot`.
2. Turn on `Force hallucinated answers` or `Inject poisoned retrieval`.
3. Go to the standalone monitoring app.
4. Click `Simulate GitHub push`.
5. Result should be `failed`, deployment should be gated, and a pre-ship email should be logged.

### 3. Post-ship failure

1. Turn pre-ship flags back off.
2. Click `Simulate GitHub push` and confirm it passes.
3. Open `Chatbot`.
4. Turn on `Trigger security regression` or `Force hallucinated answers`.
5. Open `Tracing`.
6. Click `Trigger trace webhook`.
7. Result should become `breached` and a post-ship email should be logged.

## Email setup

The demo uses Resend when these env vars are present:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — the **from** address. Its domain must be verified in Resend to deliver to arbitrary recipients; an unverified domain only delivers to the Resend account owner.
- `ALERT_RECIPIENT_EMAIL` — the **to** address for breach alerts. Set on the **monitoring** project. Takes precedence over the recipient stored in state, so you can change it without a code change.

If `RESEND_API_KEY` / `RESEND_FROM_EMAIL` are missing, the app still works and writes a local console log instead of sending an email. If `ALERT_RECIPIENT_EMAIL` is unset, alerts fall back to the recipient persisted in monitoring state.

Set or change the recipient on Vercel:

```bash
# from apps/monitoring
printf 'you@example.com' | vercel env add ALERT_RECIPIENT_EMAIL production
vercel --prod   # env changes only apply on a new deploy
```

## Monitoring storage

The standalone monitoring app uses Supabase when these env vars are present:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TABLE` defaults to `skrutai_monitoring_state`

The expected table schema is:

```sql
create table if not exists skrutai_monitoring_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
```

If Supabase is not configured, the app falls back to local file storage for the demo.

To show live GitHub workflow status in the monitoring UI, set:

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN`
- `GITHUB_WORKFLOW_FILE` defaults to `skrutai-web-gate-deploy.yml`
- `GITHUB_BRANCH` defaults to `main`

The monitoring GitHub Actions workflow expects the same Supabase secrets in repo or org secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The table schema is also available in [supabase/skrutai_monitoring_state.sql](supabase/skrutai_monitoring_state.sql).

## Real production flow

- The chatbot in `apps/web` now calls OpenAI for real and emits LangSmith traces when `LANGSMITH_TRACING=true`
- The web app also posts low-score alerts to `LANGSMITH_ALERT_WEBHOOK_URL`
- The pre-ship GitHub Action in [.github/workflows/skrutai-web-gate-deploy.yml](.github/workflows/skrutai-web-gate-deploy.yml) runs `npm run eval:pre-ship -w skrutai-web`
- The monitoring app accepts alert webhooks at `POST /api/alerts/langsmith`

## CI pre-ship gate and alert email

The GitHub Actions workflow [.github/workflows/skrutai-web-gate-deploy.yml](.github/workflows/skrutai-web-gate-deploy.yml) runs the pre-ship gate on every push to `main` (and on manual dispatch). The full alert chain is:

```
eval:pre-ship (fails, exit 1)
  -> Notify step POSTs breaching metrics to the monitoring webhook
    -> monitoring POST /api/alerts/langsmith sees metrics < thresholds (breach)
      -> Resend email to ALERT_RECIPIENT_EMAIL
```

An email is only sent when the reported metrics are **below** the monitoring thresholds. A red gate alone is not enough — the metrics themselves must breach.

### Thresholds

| Metric        | Threshold |
| ------------- | --------- |
| hallucination | 0.80      |
| ragPrecision  | 0.75      |
| ragRecall     | 0.75      |
| security      | 0.90      |

### Forcing a failure (to demo the email)

The eval reads `PRE_SHIP_FORCE_FAIL`. When truthy (`1` / `true` / `yes`) it short-circuits the LLM call, writes deterministically breaching metrics (all `0.2`), and exits `1`. There are two ways to turn it on:

**1. Manual dispatch toggle**

Actions -> "skrutai-web gate and deploy" -> Run workflow -> check "Force the pre-ship gate to fail…", or:

```bash
gh workflow run skrutai-web-gate-deploy.yml -f force_fail=true
```

**2. Commit-message flag (on push)**

`workflow_dispatch` inputs are not available on a push, so a push instead fails when the **head commit** message contains `[force-fail]`:

```bash
git commit -m "test alert path [force-fail]"
git push
```

The workflow wires both together:

```yaml
env:
  PRE_SHIP_FORCE_FAIL: ${{ inputs.force_fail || contains(github.event.head_commit.message, '[force-fail]') }}
```

Notes:
- The marker must be in the **latest** commit of the push, not an earlier one in the batch.
- A forced failure **skips the Vercel deploy** (`if: success()`) — a failing gate should not ship. The email still sends because the Notify step uses `if: always() && steps.eval.outcome == 'failure'`.
- A normal push (no marker, toggle off) runs the real LLM eval and deploys on pass.

### Required workflow secrets

- `OPENAI_API_KEY`, `OPENAI_MODEL` — pre-ship eval
- `MONITORING_ALERT_WEBHOOK_URL` — monitoring `POST /api/alerts/langsmith` endpoint
- `VERCEL_TOKEN` — deploy step (the `--project prj_…` id on the same line is an identifier, not a secret)

## Notes

- `apps/web` keeps its demo state in `.data/skrutai-web.json`.
- `apps/monitoring` uses Supabase when configured and falls back to `.data/skrutai-monitoring.json` locally.
- On Vercel, deploy `apps/web` and `apps/monitoring` as separate apps if you want independent scaling and ownership.
- The GitHub Actions workflow is included as a concrete gate example for the monitoring app. You can connect it to your real deployment path and notification provider.
