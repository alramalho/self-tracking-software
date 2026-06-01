<div align="center">

# 🎯


# Welcome to your<br/>**tracking.so*ftware***

[Open App](https://app.tracking.so)

[👋 Join the community](https://discord.gg/xMVb7YmQMQ)  of builders & lifestyle enthusiasts

<a href="https://ko-fi.com/alexramalho">
  <img src="https://img.shields.io/badge/Support-❤️-black?style=for-the-badge" alt="Support open source" />
</a>

<div class="flex flex-col items-center gap-4">

  <a href="https://discord.gg/xMVb7YmQMQ" style="
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    background-color: hsl(0 0% 9%);
    color: white;
    text-decoration: none;
    transition: background-color 150ms;
    cursor: pointer;
    border: 1px solid hsl(0 0% 9%);
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  ">
    
  </a>

  <img src="assets/img1.PNG" width="400px" alt="iPhone screenshot" />
</div>
</div>

<br/>

## Running locally

This repository is a pnpm/Turbo monorepo. Use pnpm from the repository root; the legacy `frontend`/`backend` yarn + Python instructions are stale.

### Prerequisites

- Node.js compatible with the checked-in lockfile.
- pnpm 10.x (`packageManager` is `pnpm@10.0.0`).
- Docker Desktop for the local Supabase stack.
- Supabase CLI. The root `supabase` package may warn about a missing binary on macOS; if `pnpm supabase` is unavailable, install/use a working Supabase CLI separately.

### Install and generate

```sh
pnpm install --frozen-lockfile
pnpm --filter @tsw/prisma db:generate
```

### Environment files

Create local env files from the examples:

```sh
cp apps/backend-node/.env.example apps/backend-node/.env
cp apps/frontend-vite/.env.example apps/frontend-vite/.env
```

Minimal local matrix:

| Area | Variable(s) | Required for default local build/tests? | Notes |
| --- | --- | --- | --- |
| Backend API | `PORT` | No | Defaults to `3000`. |
| Database | `DATABASE_URL` | Required for running backend against Supabase | Supabase local usually uses `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. |
| Frontend API | `VITE_BACKEND_URL` | Required for frontend talking to backend | Use `http://localhost:3000` unless `PORT` differs. |
| Clerk | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, JWT/public-key values used by auth config | Required for real authenticated app flows | Not required for `pnpm build` or default backend unit tests. |
| AI/embeddings | `OPENROUTER_API_KEY`, `HELICONE_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` | No | Default CI tests skip AI/embedding integration suites. Set explicit test flags below to run them with real credentials. |
| Push/email/payments/storage/integrations | APNs, AWS, SES/SMTP, Stripe, Telegram, Linear, PostHog variables | No | Needed only for those production-like features. |

### Start the local database

```sh
supabase start
pnpm --filter @tsw/prisma db:push
```

If you use the Supabase defaults, set backend `DATABASE_URL` to the local DB URL printed by `supabase start` (commonly `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).

### Run backend and frontend

In separate terminals:

```sh
pnpm --filter backend-node dev
pnpm --filter frontend-vite dev
```

Backend health should be available at `http://localhost:3000/health`. Vite will print the frontend URL, usually `http://localhost:5173`.

### Verification commands

```sh
pnpm build
pnpm --filter frontend-vite lint
pnpm --filter backend-node lint
pnpm --filter backend-node test:ci
pnpm --filter e2e-tests exec playwright test --list
```

Backend `test:ci` uses `vitest run` and is non-watch. AI/embedding integration suites are skipped by default so local/CI tests do not require real API keys. To run them intentionally, provide the required database/API credentials and set:

```sh
RUN_AI_INTEGRATION_TESTS=true pnpm --filter backend-node test:ci
RUN_PLAN_SIMILARITY_INTEGRATION_TESTS=true pnpm --filter backend-node test:ci
```

The `e2e-tests` package is included in the pnpm workspace so Playwright dependency resolution and test listing are deterministic from the repo root.
