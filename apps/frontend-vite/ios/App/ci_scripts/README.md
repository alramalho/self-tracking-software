# Xcode Cloud setup

Xcode Cloud runs `ci_post_clone.sh` after cloning the repository. The script:

1. Installs Node.js, Corepack, and CocoaPods when the build image does not
   provide them.
2. Installs the pinned pnpm workspace dependencies.
3. Builds the Capacitor web bundle in native iOS mode.
4. Copies the bundle into the iOS app and installs native CocoaPods
   dependencies.

Configure these workflow environment variables before starting a cloud build:

- `VITE_BACKEND_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_GOOGLE_IOS_CLIENT_ID`
- `VITE_GOOGLE_WEB_CLIENT_ID`

The backend URL must use a production HTTPS endpoint. Optional client
features also recognize `VITE_MAPBOX_TOKEN`, `VITE_POSTHOG_KEY`, and
`VITE_VAPID_PUBLIC_KEY`.
