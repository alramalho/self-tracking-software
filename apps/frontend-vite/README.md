# Frontend Vite

## Capacitor iOS Development

### Env setting 

Make sure your frontend points to the local network server:

First, print your local network address

```
ipconfig getifaddr en0
```

Then, use that in the frontend
```
cd apps/frontend-vite
export VITE_BACKEND_URL=http://192.168.10.183:3000
export VITE_SUPABASE_API_URL=http://192.168.10.183:55321
```

and backend
```
cd apps/backend-node
export SUPABASE_URL=http://192.168.10.183:55321
```

⚠️ Make sure your iPhone is connected to the same Wi-Fi as your server so they can connect.

### Build Flow

After making code or environment variable changes:

```bash
# 1. Build the Vite app (bakes env vars into JS bundle)
pnpm build

# 2. Sync to iOS project (copies build output to Xcode project)
npx cap sync ios

# 3. Open in Xcode
npx cap open ios
```

Or as a single command:
```bash
pnpm build && npx cap sync ios && npx cap open ios
```



### Why Rebuild?

- **Code changes**: Need `pnpm build` to compile
- **`.env` changes**: Vite replaces `import.meta.env.*` at build time, so env vars are baked into the bundle
- **`npx cap sync`**: Only copies files, doesn't rebuild

### Quick Reference

| Command | What it does |
|---------|--------------|
| `pnpm build` | Build Vite app |
| `npx cap sync ios` | Copy build to iOS project |
| `npx cap open ios` | Open Xcode |
| `npx cap run ios` | Build & run on device/simulator |
