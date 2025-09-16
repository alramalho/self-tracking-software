Migration froma actions to backend functions
Analyze each one individually and
1. check which endpoints should be updated / merged
2. check which endpoints should be created
After creating the endpoint you should
in actions file
- remove use server directive
- rename the actions file to service
- refactor the function to use the api (you'd need to use the @apps/frontend/src/api.ts axios helper)
These todos must be added for each vertical


Use this as TODO
[x] activities
    - `GET /activities` already returns the Prisma payload; `GET /activities/activity-entries` now includes comments/reactions with user metadata to mirror the server action
    - Frontend actions moved to `service.ts`, server directive removed, and data now fetched via `useApiWithAuth`
[x] metrics
    - Added `/metrics` router with list/create, entry upsert, today-note update, and delete endpoints; frontend now consumes them via `service.ts` with axios helper
[x] notifications
    - Added `/notifications` router with get endpoint, fontend now consumes the via `service.ts` with axios helper
[x] plans
    - Added `/plans` family endpoints (list, plan fetch with optional activities, bulk update, milestone modify, coach-session maintenance, invitation fetch) and wired provider through `service.ts` using axios helper
[x] timeline
    - Added `/users/timeline` backend route and switched client to axios-backed `service.ts` that normalizes timeline entries, activities, and users
[x] users
    - Added richer `/users/user`, `/users/get-user`, `/users/user` PATCH, and `/users/public/:username` routes; frontend now uses axios-powered service with normalised payloads and metadata uses new public endpoint


Final cleanup
-- make sure apps/frontend/src/lib/server-utils.ts validateUser is no longer used (now in backend)
