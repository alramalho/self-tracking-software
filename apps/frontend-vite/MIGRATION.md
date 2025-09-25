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

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
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

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /search TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
## /profile/{username} TODO

[] analyse route (page.tsx and respective layout if existent)
[] analyse respective depedencies (packages, components, hooks, contexts)
[] migrate respective route code
[] install missing dependencies
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
Use pnpm for any depedencies install
Start!