-- In-app circle invites are recorded in the join funnel.
ALTER TYPE "public"."CircleEventKind" ADD VALUE 'INVITED';
