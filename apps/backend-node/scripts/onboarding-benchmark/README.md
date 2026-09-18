# Onboarding decision pilot — v2 draft

**Current review:** [CASES-REVIEW.md](CASES-REVIEW.md). The user requested production-grounded cases and review before comparison. The v2 runner is locked pending approval of exact case/prompt hashes in `review.json`. It uses **Vercel AI Gateway only**. No v2 model calls have been made.

V2's capability boundary follows the latest product discussion: help users follow through on a goal or existing course/training programme; do not replace expert teaching. `cases-v2.json` and `prompt-v2.md` are the current sources. `cases.json` and `prompt.md` retain the superseded v1 experiment for provenance and are not loaded by the runner.

Small, isolated comparison of requested model APIs. It does not call the production backend, access user records, create plans, start trials, send notifications, or deploy changes. It uses the existing AI Gateway key through the backend's dotenv file; no credentials are written to results. Only synthetic examples derived from the user's stated goals are sent.

The proposed coaching contract is: choose the next useful real-world action, organize the user's chosen programme within their commitments, clarify a resource or route a technical question to its teacher, and propose changes when the commitment does not fit. Onboarding supplies confirmed facts. Conditional examples are not user facts; actions remain proposals. Free-tracker intent must end the coaching interview.

## Run

From `apps/backend-node`:

```sh
node scripts/onboarding-benchmark/run.mjs --describe
node scripts/onboarding-benchmark/build-review.mjs
node scripts/onboarding-benchmark/run.mjs /absolute/path/to/results
```

The first two commands are offline: describe exact cases/model IDs/hashes and regenerate the review from its JSON source. Only after the user approves the case set and capability boundary, set `review.json` status to `approved` and record both matching hashes shown by `--describe`. Any change to the cases or prompt invalidates approval. Do not manufacture approval. The run command currently exits before reading credentials or contacting the gateway.

Calls five exact catalog model IDs: Muse Spark 1.3, Grok 4.6, Gemini 3.8 Flash, GPT-5.6 Terra, GLM 5.3. No substituted contributor/fast/flash models. Two workers, at most 90 calls, 4,096 output-token cap, two-minute request timeout, no retries. Same JSON envelope and prompt with provider defaults for reasoning/temperature; this does not establish equivalence of reasoning budgets. Catalog presence is checked before calls; actual availability is measured by responses.

Authentication failure stops further queued calls (one concurrent request may already be in flight). A run with no parsed model responses exits unsuccessfully. The early pilot exposed an outdated SDK metadata validator against the current mixed-modality catalog, so this isolated runner reads the documented public catalog directly; no production dependencies were changed.

Cases are simple tracking, running, guitar, meditation, reading, weight management, productivity and overcommitment. Each has an initial and a fully informed checkpoint. These are independent prompts with identical user evidence across models, not a simulated conversation replying to each model's generated question. Guitar adds isolated time-only and blocker-only variants. Initial model output is not included in informed or variant prompts. The old v1 counterfactual changed ability and time together and has been superseded.

`metadata.json` records configuration and catalog prices. Each call is saved as it finishes, without hidden reasoning. `results.json` aggregates results. Run into a fresh output directory. Prices are estimated using reported prompt/completion tokens and base catalog rates, ignoring cache discounts and provider-specific adjustments; they are not verified charges.

## Review

Read anonymized outputs before looking at model IDs. Judge: does the screen ask one answerable thing; does it collect consequential missing information; does it avoid re-asking known facts; does the follow-up use the answer; does it respect time, uncertainty and free-tracker intent; does it stop when a useful next action is possible? Check guitar's counterfactual for substantive differences. Report specific examples and material failures, not a spurious aggregate intelligence score.

Contract checks measure renderability and evidence quotations only. They cannot establish domain correctness, safety, user engagement or improved consistency. One sample per checkpoint is a pilot, not a statistically reliable ranking. No model-based judge is run.

## Feeding this back into the app

Proposed flow: user answer → validated, source-linked draft facts → next screen or draft action → user confirmation → existing plan/session/tracker APIs. Store trial/entitlement status separately from walkthrough state. Trial opt-out retains answers and a resumable draft without running paid coaching. Reconfirmation is needed for stale dates, ability, schedule and priorities. Existing `generate-plans` can consume the confirmed brief once this contract is implemented; this pilot does not wire that production path.

## Read-only production evidence for case selection

The inference runner does not query production. The separate `production-snapshot.cjs` runs aggregate SQL in an explicit READ ONLY, Repeatable Read transaction with statement/transaction timeouts. It reads the running production backend container's existing connection without exporting credentials. It does not load the backend app or execute cron jobs. It returns aggregate counts, category labels and activity titles shared by at least two users; it never returns names, emails, notes, messages, individual IDs or goal text. No production records or service configuration changed.

From `apps/backend-node`, on this Mac:

```sh
ssh -i ~/.ssh/hetzner_ed25519 -o BatchMode=yes -o ConnectTimeout=10 root@89.167.84.67 'docker exec -i tsw-backend node' < scripts/onboarding-benchmark/production-snapshot.cjs > /Users/alramalho/workspace/tracking.so/output/coach-benchmark/production-snapshot-2026-09-14-v2.json
```

The verified container was `tsw-backend`, image `local/tracking-so-backend:wrapped-2025-search-20260914`, not the staging `tsw-backend-localdb` service. Snapshot time: 2026-09-14T21:37:58.311Z, transaction_read_only=on. Cohort counts and limitations are in the review. Category totals independently reconcile with plan-mode totals for all three cohorts. Stored categories are not independently expert-adjudicated. Explicit synthetic-account patterns excluded zero additional accounts; the schema has no definitive test-account flag. Soft-deleted users/plans/activities/entries are excluded as applicable. Plan prevalence includes archived plans; separately named current-plan counts mean unarchived/unpaused, without reconstructing goal completion.

Only synthetic review cases derived from these aggregate patterns will go to the model gateway. The full local aggregate snapshot is supporting evidence, not inference input. No domain labels, expected judgements, real-user data or answers withheld for another checkpoint are leaked into case prompts.

## Status on September 14, 2026

All five requested exact model families were present in both public catalogs (OpenRouter uses `x-ai/grok-4.6` and `z-ai/glm-5.3`). The app's saved AI Gateway credential returned HTTP 401 on all 20 initial requests in the first attempt; no follow-ups ran and no model-generated answers were obtained. OpenRouter's existing credential also returned HTTP 401 on its key-status endpoint; no inference was attempted there. `.env.prod` held the same gateway credential, so it was not retried as a different identity. No provider-specific conclusion or model preference is supported.

First failed attempt: `/Users/alramalho/workspace/tracking.so/output/coach-benchmark/pilot-2026-09-14/`. After that attempt, the runner was changed to stop the queue on authentication errors. To resume, configure a working `AI_GATEWAY_API_KEY` locally (do not put credentials into tracked files or chat), then run into a fresh output directory. Catalog cost estimates from the failed attempt are not evidence of billed usage. This is a prepared benchmark with blocked execution, not a completed comparison.
