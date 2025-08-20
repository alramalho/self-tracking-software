## Migration notes & plan

This page is where we will store important notes to self as well as a Todo list for our comprehensive migration.

We will be migration from ./backend in FASTAPI / MongoDB to backend-node in Express JS / Prisma / Postgres


## App description

This app tracking.so is a lifestlye tracking tool where users can have friends and log activities as well as have plans and some AI features, like metrics / coaching.


## Notes
There is a lot of dead code, so we will only migrate the necessary logic by starting in our routers and drilling through

## TODOs

[x] create backend scaffold w/ prisma and express js
[x] carefully analyze existent schema under backend/src/entities
[x] create prisma schema for relational DB postgres
[x] analyze backend/app.py for fastapi declaraion and create correspondent express scaffold
[x] analyze backend/routers/users and create correspondent express equivalent
    [x] create necessary gateways based on what the router uses
[x] analyze backend/routers/clerk and create correspondent express equivalent
    [x] implemented webhook verification using svix package
    [x] handles user.created, user.updated, user.deleted events
[x] analyze backend/routers/activities and create correspondent express equivalent
    [x] implemented all activity CRUD endpoints with Prisma
    [x] activity logging with full S3 photo upload support
    [x] reactions and comments system
    [x] notifications for friends
    [x] proper authentication and ownership verification
[x] analyze backend/routers/admin and create correspondent express equivalent
    [x] admin authentication with API key
    [x] notification sending (individual and bulk)
    [x] user statistics and management
    [x] public error logging with rate limiting and security
    [x] S3 URL regeneration endpoint with full AWS S3 integration
    [x] health check endpoint
    [x] run-daily-metrics-notification endpoint (placeholder)
    [x] run-hourly-job endpoint (plan coaching logic TODO)
    [x] run-daily-job endpoint with unactivated email processing
    [x] SES service for email sending with full AWS SES integration
[x] analyze backend/routers/ai and create correspondent express equivalent
    [x] audio transcription endpoint with full OpenAI Whisper integration
    [x] coach message generation (placeholder with notification)
    [x] daily checkin extractions with full AI-powered activity/metric extraction
    [x] past week logging extractions (placeholder structure)  
    [x] plan extractions with full AI-powered plan creation
    [x] profile updates from questions with full AI analysis and DB updates
    [x] rejection feedback endpoints for user feedback
    [x] dynamic UI logging endpoints
    [x] proper authentication and error handling 
[x] analyze backend/routers/messages and create correspondent express equivalent
    [x] implemented move-up message endpoint with timestamp update
    [x] proper authentication and error handling
    [x] direct Prisma integration without gateway (simple single endpoint)
[x] analyze backend/routers/metrics and create correspondent express equivalent
    [x] implemented all metric CRUD endpoints with Prisma integration
    [x] metric creation with duplicate name checking
    [x] metric logging with upsert functionality (update existing or create new)
    [x] metric skipping with proper status tracking
    [x] metric entry retrieval with optional filtering
    [x] metric deletion with ownership verification
    [x] today's note logging across all entries
    [x] today's note skipping with proper status tracking
    [x] proper authentication and error handling
[x] analyze backend/routers/onboarding and create correspondent express equivalent
    [x] implemented check-plan-goal endpoint with AI question analysis
    [x] implemented generate-plan-activities endpoint with AI activity extraction
    [x] implemented generate-plans endpoint with AI-powered plan creation
    [x] AI-powered goal paraphrasing and guidelines extraction
    [x] plan creation with sessions and activity associations
    [x] conversation memory integration for context awareness
    [x] proper authentication and error handling
    [x] direct Prisma integration for plan, activity, and session management
[x] analyze backend/routers/plans and create correspondent express equivalent
    [x] implemented plan creation with group and activity associations
    [x] implemented invitation link generation for external sharing
    [x] implemented plan retrieval (user plans and specific plan)
    [x] implemented plan removal and soft deletion
    [x] implemented AI-powered session generation
    [x] implemented plan updates and order management
    [x] plan group and member management integration
    [x] proper authentication and authorization
    [x] direct Prisma integration with plan, session, and activity models
    [x] note: some features require User model planIds field implementation
[x] analyze backend/routers/stripe and create correspondent express equivalent
    [x] implemented Stripe webhook endpoint with signature verification
    [x] handled subscription events (created, updated, deleted, paused, resumed)
    [x] handled payment intent succeeded events
    [x] user plan type updates based on Stripe product IDs
    [x] Stripe customer and subscription data storage
    [x] proper error handling and logging
    [x] raw body middleware setup for webhook signature verification
    [x] direct Prisma integration for user updates
    [x] Telegram notifications for errors, unknown products, and new subscriptions
    [x] note: email notifications implemented with SES service
    [x] Loops.so integration for plus upgrade events
    [x] Telegram notifications for new subscriptions, errors, and unknown products
[x] analyze backend/routers/notification and create correspondent express equivalent
    [x] implemented PWA status updates for push notifications
    [x] implemented notification processing with push notifications
    [x] implemented notification loading with engagement filtering
    [x] implemented clear all notifications functionality
    [x] implemented PWA subscription management
    [x] conversation memory integration for AI notifications
    [x] proper authentication and error handling
    [x] direct Prisma integration with notification model
    [x] simplified NotificationService without scheduled notification complexity
    [x] push notification system with web-push integration (mock implementation ready)
    [x] removed scheduled notification system (redundant with existing /run-hourly-job)
    [x] cleaned up Prisma schema to remove scheduling fields
    [x] note: PostHog analytics integration is TODO item (low priority)
    [x] note: web-push package installed in production environment
[x] create other ncessary services
    [x] telegram_service
    [x] s3Service - full AWS S3 integration with upload, delete, presigned URLs
    [x] sesService - full AWS SES integration with email sending, bulk emails, templates
    [x] sttService - full OpenAI Whisper integration for speech-to-text
    [x] aiService - full Vercel AI SDK integration for structured AI responses
    [x] loopsService - full Loops.so integration for email marketing events
    [x] memoryService - conversation memory management for AI context
[x] Complete remaining TODOs and fix incomplete logic from initial migration:
    [x] Plans system integration in admin routes and AI routes
    [x] User profile endpoint completion with plans and activities
    [x] Telegram notifications in AI routes for feedback and errors
    [x] Feedback system completion with SES email sending and notifications
    [x] Error handler improvement to extract user context from authenticated requests
    [x] Messages loading functionality implementation
    [x] Timezone validation against IANA timezone identifiers
[] Adapt legacy data layer UserGlobalContext that relied on previous models to instead use prisma types (@prisma/client already configured in frontend)
    - [] list all places where models from UserGlobalContext are being user

# leaving out
[] axiom
[] infrastructure
[] hume service
[] anything not necessary in the exposed routes
[] ai assistants

## notes to self
...

## TESTS (local)

backend
[X] health
[X] api/users/all-users (non auth)
[x] register via webapp (clerk webhook)
[x] signin
[x] load users data
[x] onboarding
[x] adding activity
[x] editing activity
[x] uploading activity w/o photo 
[x] uploading activity w/ photo 
[x] updating activity
[x] checking both in timeline
[ ] reacting
[ ] comment
[ ] check both there after refresh
[ ] 
-- user profile
[x] can update settings (like looking for ap)
...
-- notifications
[x] can see
[x] can dismiss
[] push notify works
-- plans
[x] create plan with
    [x] date
    [x] name
    [x] emoji
    [x] activities
    [x] generated sessions
    [x] times pe week
    [x] milestones
[x] milestones
    [x] render
    [x] edit (manual)
    [x] edit (automatic)
-- metrics
[x] log metric
[x] check metric logged
-- recommendations
[x] implement plan index (now we don't have planIds array anymore)
[x] can compute recommended users
[x] can see recommended users

## missing verticals

[x] proper indexing (seems slow)
[x] creating local db
[] new supabase project for prod
[] deploying
[] on clean data: test out notifications & recommendation system
[] data migration

## Additional packages to install in production

For the notification system to work fully, install this package in the Node.js backend:
```bash
npm install web-push @types/web-push
```

This provides:
- Web Push API for browser push notifications
- TypeScript support for web-push

Note: Scheduled notifications are handled by the existing `/run-hourly-job` endpoint, so AWS EventBridge cron integration was removed to avoid duplication.