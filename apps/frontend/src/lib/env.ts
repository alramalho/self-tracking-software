export function validateEnv() {
  const requiredEnvs = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_BACKEND_URL",
    // ... other required env vars
  ] as const;

  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }
}
