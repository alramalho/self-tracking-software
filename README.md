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

This repository is a pnpm/Turbo monorepo. The current app lives in `apps/frontend-vite` and `apps/backend-node`; the old `frontend`/`backend` yarn + Python instructions no longer match the repo layout.

Install dependencies and generate Prisma client code from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @tsw/prisma db:generate
```

Create local env files from the examples and fill in the credentials needed for the flows you want to exercise:

```sh
cp apps/backend-node/.env.example apps/backend-node/.env
cp apps/frontend-vite/.env.example apps/frontend-vite/.env
```

For normal local development, run the database, backend, and frontend in separate terminals:

```sh
supabase start
pnpm --filter @tsw/prisma db:push
pnpm --filter backend-node dev
pnpm --filter frontend-vite dev
```

Backend health should be available at `http://localhost:3000/health`. Vite will print the frontend URL, usually `http://localhost:5173`.

### Readiness checks vs. app startup

The app can build and start locally even when optional quality commands are not clean. Use these checks for CI/readiness work, not as proof that local app startup is broken:

```sh
pnpm build
pnpm --filter frontend-vite lint
pnpm --filter backend-node lint
pnpm --filter backend-node test:ci
pnpm --filter e2e-tests exec playwright test --list
```

At the time this note was added, `pnpm build` passes on `main`, while some lint/test/e2e checks still need separate cleanup or credentials. Treat those as CI hygiene items unless your current task is specifically to make those commands green.
