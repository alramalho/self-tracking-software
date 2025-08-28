# Database Migration Script

This script migrates all data from a production database to a development database while preserving all relationships and data integrity.

## Prerequisites

1. Set the required environment variables:
   ```bash
   export PROD_DATABASE_URL="postgresql://..."  # Source database (production)
   export DEV_DATABASE_URL="postgresql://..."   # Target database (development)
   export NODE_ENV="development"
   ```

2. Ensure both databases are accessible and the dev database schema is up to date:
   ```bash
   pnpm db:push  # Apply schema to dev database
   ```

## Usage

Run the migration script:

```bash
# Using npm script
pnpm migrate-prod-to-dev

# Or directly with ts-node
pnpm db:migrate-prod-to-dev
```

## What it does

The script first shows a **confirmation prompt** with:
- ⚠️ Clear warning about data destruction
- 🔍 Masked database URLs (credentials hidden)
- ✋ Requires typing "CONFIRM" to proceed

Then performs a complete data migration in the following order:

1. **Clear target database** - Removes all existing data from development database
2. **Migrate Users** - Copies all users (handles referral relationships in two passes)
3. **Migrate PlanGroups** - Copies plan groups with member relationships
4. **Migrate Activities** - Copies all activities linked to users
5. **Migrate Metrics** - Copies all metrics linked to users
6. **Migrate Plans** - Copies plans with activity and plan group relationships
7. **Migrate Activity Entries** - Copies all activity entries
8. **Migrate Metric Entries** - Copies all metric entries
9. **Migrate Plan Sessions** - Copies plan sessions linked to plans and activities
10. **Migrate Plan Milestones** - Copies plan milestones
11. **Migrate Connections** - Copies user connections (friend relationships)
12. **Migrate Plan Invitations** - Copies plan invitations between users
13. **Migrate Reactions** - Copies reactions on activity entries
14. **Migrate Comments** - Copies comments on activity entries
15. **Migrate Messages** - Copies messages and their emotions
16. **Migrate Notifications** - Copies all notifications
17. **Migrate Recommendations** - Copies user recommendations

## Important Notes

- ⚠️ **This will completely wipe the development database** before copying data
- The script only runs in development environment (`NODE_ENV=development`)
- All foreign key relationships are preserved using ID mapping
- The migration maintains referential integrity by migrating in dependency order
- Large datasets may take several minutes to complete

## Safety Features

- **Interactive confirmation prompt** with clear warnings and masked database URLs
- Environment validation (requires `PROD_DATABASE_URL` and `DEV_DATABASE_URL`)
- Development environment check (prevents accidental production runs)
- User must type "CONFIRM" exactly to proceed
- Transaction safety (each table migration is atomic)
- Detailed logging of migration progress
- Proper error handling and cleanup

## Troubleshooting

If the migration fails:

1. Check that both database URLs are correct and accessible
2. Ensure the development database schema is up to date
3. Verify you have sufficient permissions on both databases
4. Check the console output for specific error messages

The script will automatically disconnect from both databases on completion or error.