## Next to vite migration 
We are migrating fron apps/frontend (next js) to apps/frontend-vite (vite).
This new frontend repo uses Tanstack Router and the idea is to be fully static exportable.

The ultimate goal will be to load into into capacitor JS, so we want to stay away from any Server Side Rendering, as this is not supported.

This old repo is full of dead and lingering code, so we will take this opportunity to migrate only the necessary files.

The old repo uses tanstack query for state management, which we will want to keep
The migration will be spearheaded by the routes, which for each of them, we will create a TODO section, based on the template below

## TODO template

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies


## Routes to migrate

/download
/signin
/signout
/ 
/add
/plans
/search
/profile/{username}
/friends/{username}
/onboarding
/insights/
/insights/dashboard
/insights/onboarding
/create-new-plan

Start with the route code, then on your analysis indentify the needed dependencies. dont start with the dependencies ,as said there is clutter, like the sync storage persister, that shit isnt being utilized. So dont assume
  something is needed just because it is on the package json or even in one component in the old repo. You must start with the source of truth, and branch out, The source of truth are the route files (page.tsx and layout.tsx)

## /download TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies

....

## /download TODO

[x] analyse route (page.tsx and respective layout if existent)
[x] analyse respective depedencies (packages, components, hooks, contexts)
[x] migrate respective route code
[x] install missing dependencies

### Analysis:
- Route: `/download` - Shows app installation instructions based on platform/browser
- No layout.tsx
- Components needed: DownloadComponent
- Hooks needed: useMediaQuery, useShareOrCopy, useClipboard, useShare
- Context needed: useCurrentUser (from users context)
- External deps: lucide-react icons, react-hot-toast
- UI components: Button
- Utilities: cn (clsx + tailwind-merge)

## /signin TODO

[x] analyse route (page.tsx and respective layout if existent)
[x] analyse respective depedencies (packages, components, hooks, contexts)
[x] migrate respective route code
[x] install missing dependencies

### Analysis:
- Route: `/signin` - Authentication page using Clerk ➜ **MIGRATED WITH CLERK**
- Uses AuthLayout component with Lottie animations ✅
- Dependencies: @clerk/clerk-react, react-lottie, AuthLayout ✅
- **COMPLETED**: Kept Clerk for auth (better approach!)
- Created ClerkProvider wrapper
- Migrated AuthLayout with fire animation
- Uses Clerk's native SignIn component
- Connected to existing backend via API client
- Environment configured with existing Clerk keys
## /signout TODO

[x] analyse route (page.tsx and respective layout if existent)
[x] analyse respective depedencies (packages, components, hooks, contexts)
[x] migrate respective route code
[x] install missing dependencies

### Analysis:
- Route: `/signout` - No dedicated route in old frontend, signout handled through Clerk context
- No layout.tsx needed
- Components needed: None (simple signout page with loading spinner)
- Hooks needed: useAuth from @clerk/clerk-react, useNavigate from @tanstack/react-router
- Context needed: None (uses Clerk directly)
- External deps: Already installed (@clerk/clerk-react)
- **COMPLETED**: Created simple signout route that uses Clerk's signOut and redirects to /signin
- Shows "Signing you out..." message with loading spinner
- Handles errors gracefully by still redirecting to signin
## / TODO

[x] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies

### Analysis:
- Route: `/` - Main dashboard/homepage
- **VERY COMPLEX**: Multiple contexts, components, auth, pull-to-refresh
- Dependencies: Many complex components and contexts
- **DECISION**: Skip for now, too complex
## /add TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /plans TODO

[x] analyse route (page.tsx and respective layout if existent)
[x] analyse respective depedencies (packages, components, hooks, contexts)
[x] migrate respective route code (basic implementation)
[x] install missing dependencies

### Analysis:
- Route: `/plans` - Shows welcome message with user name and renders PlansRenderer
- No layout.tsx needed
- Components needed: PlansRenderer (very complex with drag&drop, plan management)
- Hooks needed: useCurrentUser context, search params handling
- Context needed: User context for welcome message, Plans context for PlansRenderer
- External deps: Complex - @dnd-kit/core, @dnd-kit/sortable, date-fns, many components
- **BASIC IMPLEMENTATION COMPLETED**: Created simple plans route with:
  - Basic user authentication check using Clerk
  - Welcome message with user's full name
  - Placeholder for complex PlansRenderer component
  - TODO: Need to implement full PlansRenderer with all dependencies later
## /search TODO

[x] analyse route (page.tsx and respective layout if existent)
[x] analyse respective depedencies (packages, components, hooks, contexts)
[x] migrate respective route code
[x] install missing dependencies

### Analysis:
- Route: `/search` - User search page with recommendations and notifications gating
- No layout.tsx
- Components needed:
  - UserSearch (search users with debouncing)
  - CollapsibleSelfUserCard (shows current user's card)
  - RecommendedUsers (grid of recommended user cards)
  - UserCard (display user with plans, activities, friend request buttons)
  - AppleLikePopover (already exists ✅)
- Hooks needed:
  - useNotifications (isPushGranted, requestPermission)
  - useCurrentUser, usePlans, useRecommendations
  - useApiWithAuth
- External deps:
  - react-simple-pull-to-refresh (for pull to refresh)
  - framer-motion (already installed ✅)
  - lucide-react (icons ✅)
- Features:
  - Notification permission gate before accessing search
  - Pull-to-refresh to recompute recommendations
  - User search with real-time results
  - Recommended users based on compatibility score
  - Connection status tracking (pending, accepted, etc.)

### Migration Status: ✅ COMPLETED (with simplified components)
- Created UserSearch component ✅
- Created simplified CollapsibleSelfUserCard ✅
- Created simplified RecommendedUsers ✅
- Created /search route with notification gating and pull-to-refresh ✅
- Installed react-simple-pull-to-refresh ✅
- **NOTE**: UserCard component not fully migrated - using simplified card views
- **TODO**: Migrate full UserCard with PlanStreak, friend request functionality, activities display
## /profile/{username} ✅ COMPLETED

[x] analyse route (page.tsx and respective layout if existent)
[x] analyse respective depedencies (packages, components, hooks, contexts)
[x] migrate respective route code
[x] install missing dependencies

### Analysis:
- Route: `/profile/{username}` - User profile page with TikTok-style layout
- No layout.tsx needed
- Components needed:
  - BadgeCard ✅ (migrated)
  - ProgressRing ✅ (migrated)
  - BadgeExplainerPopover ✅ (stub created)
  - MedalExplainerPopover ✅ (stub created)
  - SmallActivityEntryCard ✅ (already exists)
  - Avatar, Button, Skeleton, Tabs (UI components) ✅
- Hooks needed:
  - useUnifiedProfileData ✅ (migrated)
  - useAccountLevel ✅ (migrated)
  - usePlansProgress ✅ (already exists)
  - useUserProgress ✅ (already exists)
- Context needed: Users, Activities, Plans, PlansProgress (all exist) ✅
- External deps: lucide-react ✅, date-fns ✅, FireAnimation ✅

### Migration Status: ✅ COMPLETED
- Created profile.$username.tsx route ✅
- Migrated useUnifiedProfileData hook ✅
- Migrated useAccountLevel hook with level system ✅
- Migrated BadgeCard component ✅
- Migrated ProgressRing component ✅
- Created stub Badge/Medal explainer popovers ✅
- Implemented core profile features:
  - Avatar with progress ring ✅
  - Stats (friends, entries) ✅
  - Badge system (streaks, habits, lifestyles) ✅
  - Connection requests (send/accept/reject) ✅
  - Tabs for plans and activity history ✅
- **NOTE**: Plans tab shows count only - TODO: render with PlanActivityEntriesRenderer
- **NOTE**: Missing ProfileSettingsPopover for own profile settings
- **NOTE**: Badge/Medal explainer popovers are stubs - need full implementation
## /friends/{username} TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /onboarding TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /insights/ TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /insights/dashboard TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /insights/onboarding TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /create-new-plan TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies

## / TODO (home) warning: complex, includes timeline
 
## /create-new-plan ✅ BASIC IMPLEMENTATION

[x] analyse route (page.tsx and respective layout if existent)
[x] analyse respective depedencies (packages, components, hooks, contexts)
[x] migrate respective route code (simplified implementation)
[x] install missing dependencies

### Analysis:
- Route: `/create-new-plan` - Plan creation with upgrade gate
- No layout.tsx
- Components needed:
  - AppleLikePopover (already exists ✅)
  - CreatePlanCardJourney (simple wrapper) ✅
  - PlanConfigurationForm (complex, 6-step form with AI generation) 🚧
- Hooks needed:
  - usePlans (already exists ✅)
  - useUpgrade (already exists ✅)
  - usePaidPlan (migrated ✅)
  - useCurrentUser (already exists ✅)
- Context needed: Plans, Upgrade, Users (all exist ✅)
- External deps: lodash (capitalize), twMerge ✅
- Features:
  - Plan limit check based on user tier (FREE: 1 plan, PLUS: 100 plans)
  - Upgrade popover when limit reached
  - Full plan creation flow when under limit

### Migration Status: ✅ BASIC IMPLEMENTATION COMPLETED
- Created /create-new-plan route ✅
- Migrated usePaidPlan hook with proper tier limits ✅
- Created CreatePlanCardJourney wrapper component ✅
- Created simplified PlanConfigurationForm stub ✅
- **NOTE**: PlanConfigurationForm not fully migrated - using stub with TODO
- **TODO**: Migrate full PlanConfigurationForm with all 6 steps:
  1. Duration selection (CUSTOM, ONE_MONTH, THREE_MONTHS, SIX_MONTHS, ONE_YEAR)
  2. Goal input
  3. Emoji selection
  4. Activities selection (multi-select from user's activities)
  5. Outline type (SPECIFIC with AI-generated sessions vs TIMES_PER_WEEK)
  6. Milestones configuration

## / TODO (home) warning: complex, includes timeline
 
[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
Use pnpm for any depedencies install
Start!