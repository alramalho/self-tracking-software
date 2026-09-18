const { spawn } = require("node:child_process");
const path = require("node:path");
const { root, frontendEnv } = require("./environment.cjs");
const app = path.join(root, "apps/frontend-expo");
const child = spawn(
  process.execPath,
  [
    path.join(app, "node_modules/expo/bin/cli"),
    "start",
    "--web",
    "--clear",
    "--port",
    "8084",
  ],
  {
    cwd: app,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_E2E: "false",
      EXPO_PUBLIC_BACKEND_URL: "http://127.0.0.1:4318",
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: frontendEnv.VITE_CLERK_PUBLISHABLE_KEY,
      EXPO_NO_TELEMETRY: "1",
    },
  },
);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
