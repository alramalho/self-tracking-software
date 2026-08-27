# Supabase exit

Tracking no longer uses Supabase at runtime.

- Browser and native sign-in use Clerk.
- Apple Watch access and refresh tokens are issued by the Tracking backend.
- Production data lives in PostgreSQL on the Hetzner VPS.
- Prisma migrations run against the VPS database.

The historical Prisma migrations still contain Supabase-era schema history. Do
not rewrite those migrations; new installations need that history to arrive at
the current schema.
