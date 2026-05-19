# Backend migration: AWS → Hetzner

## Goal

Move `tracking.so` backend off AWS (Flightcontrol-managed Fargate + CloudFront/ALB + WAF + cron Lambda, ~$108/mo) onto a self-managed Hetzner Cloud VM. Keep external deps (Supabase Postgres, Pinecone, Clerk, Stripe, AWS S3/SES) untouched.

## Status

### Done
- **VM**: `tsw-backend` (CPX32, 4 vCPU / 8 GB / 160 GB, `hel1`) at `89.167.84.67` / `2a01:4f9:c014:5c59::1`. ~€13.6/mo.
- **Bootstrap**: Docker 29.4.1, Docker Compose v5.1.3, UFW 22/80/443 (via [cloud-init.yaml](./cloud-init.yaml))
- **Stack on box**: backend container + Caddy 2 TLS termination → Let's Encrypt ([docker-compose.yml](./docker-compose.yml), [Caddyfile](./Caddyfile)). Active remote directory is `/root/tracking-so-hetzner`.
- **DNS**: `api-hetzner.tracking.so` and `api.tracking.so` A + AAAA resolve to Hetzner.
- **Deploy**: currently GitHub Actions/GHCR-backed on the box; local manual deploy script exists but is not the active remote layout. Treat [hetzner/.env.prod](./.env.prod) as the local secret source of truth for the Hetzner runtime env.
- **Env**: active box env has `API_DOMAIN=api-hetzner.tracking.so, api.tracking.so`, so Caddy serves both hostnames.
- **Error-notifier cleanup**: [errorHandler.ts](../apps/backend-node/src/middleware/errorHandler.ts) now pages only on 5xx; killed the `allowed-routes.txt` / WAF allow-list premise
- **Verified**: `https://api-hetzner.tracking.so/health` → `{"status":"ok"}` HTTP 200 via Caddy.
- **Web smoke test**: `test-migration.tracking.so` Vercel preview is configured with `VITE_BACKEND_URL=https://api-hetzner.tracking.so`; Supabase auth redirect allow-list includes the test domain; login + activity update worked against Hetzner.
- **Production cutover**: `app.tracking.so` now reaches Hetzner through `https://api.tracking.so`; verified `/health` via Caddy and production login/data loading after adding missing `messages.readAt`.

### Inventory captured (for teardown)
- **Flightcontrol-managed** (former prod): ECS cluster + service `fc-web-server-dvrpa1-6ba11x8`, ALB with same name, VPC `fc-self-tracking-software-0nb10m`. Must be torn down **via Flightcontrol dashboard**, not AWS console.
- **CDK-managed remnants**: `TrackingSoftwareInfrastructureStackproductionApiStack070335E4` (WAF only — Fargate code already commented out), parent stack, plus sandbox/dev stacks.
- **Cron proxy Lambda**: `trackingSoftwareApiCronProxyLambdasandbox` (sandbox only — prod cron is now `node-cron` inside the app)
- **DNS authority**: `tracking.so` is managed by Namecheap / `registrar-servers.com`, not by the Route53 zone in this AWS account. Old prod record was `api.tracking.so CNAME d1eevim432y2yu.cloudfront.net`; rollback is to restore that CNAME.
- **Route53 zone**: `api.tracking.so.` exists in AWS account `854257060653` but only has NS/SOA and is not currently authoritative for production traffic.
- **Other projects in this AWS account** (reddit­leads, jarvis, yThinkingApp, agr, BuildingIdentifier, HippoPrototype, Fidel) — **out of scope**, not touching

## Open TODOs

### Cutover
- **Completed 2026-05-07**: In Namecheap DNS, replaced `api.tracking.so CNAME d1eevim432y2yu.cloudfront.net` with:
  - `A api 89.167.84.67`
  - `AAAA api 2a01:4f9:c014:5c59::1`
- Recreated Caddy on the box with `API_DOMAIN=api-hetzner.tracking.so, api.tracking.so`; Caddy obtained/served the `api.tracking.so` certificate.
- Verified `https://api.tracking.so/health` returns 200 with `via: 1.1 Caddy` and no CloudFront headers.
- Legacy AWS/Flightcontrol backend deploy workflows were removed after cutover. Rollback now requires intentionally restoring old infrastructure/DNS instead of happening through CI.

### Known post-cutover gaps
- **APNS key missing from image** — [apple-stuff/AuthKey_MG38JC6M33.p8](../apps/backend-node/apple-stuff/AuthKey_MG38JC6M33.p8) is gitignored, so the deployed image/box does not include it. Backend warns "APNs key file not found… iOS push notifications will not work." Fix later by shipping the file securely to the box/image. Web migration does not depend on this.
- **Schema drift hotfix** — Hetzner exposed a missing production DB column, `messages.readAt`, used by `/chats`. It was hotfixed in prod and recorded in [20260507163500_add_message_read_at](../packages/prisma/migrations/20260507163500_add_message_read_at/migration.sql).

### AWS/Flightcontrol teardown
1. Stop the Flightcontrol project (Flightcontrol dashboard) — this removes ECS/ALB/VPC/NAT/SGs.
2. `aws cloudformation delete-stack --stack-name TrackingSoftwareInfrastructureStackproductionApiStack070335E4` (WAF) + parent stack.
3. Clean up sandbox/dev CDK stacks: `TrackingSoftwareInfrastructureStackdev*`, `TrackingSoftwareInfrastructureStacksandbox*`.
4. Delete `trackingSoftwareApiCronProxyLambdasandbox`.
5. Verify next-day Cost Explorer shows ECS/ELB/WAF lines at 0.

### Nice-to-haves (after teardown is stable)
- **Log shipping**: wire backend container to Axiom or Better Stack (you already have creds). Currently logs are `docker compose logs` only.
- **Backups**: Supabase Postgres is managed so no DB backup concern, but VM state (Caddy data, any runtime-generated files) is unsnapshotted. A Hetzner snapshot schedule would be prudent (~€0.5/mo).
- **Healthcheck false-positive**: compose reports backend `unhealthy` despite serving 200s — `wget` check needs tuning or swap to a curl-based probe.
- **Separate AWS cleanup pass** for the unrelated dead-side-project stacks (Fidel '22, HippoPrototype '23, Jarvis, AGR, BuildingIdentifier, yThinkingApp, parts of redditleads). Likely ~$5-15/mo cumulative.

## Rollback plan

If Hetzner has issues after teardown, rollback is no longer a one-DNS-record operation. Recreate or re-enable backend infrastructure first, then repoint `api.tracking.so` in Namecheap.
