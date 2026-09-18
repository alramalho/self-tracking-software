const { backend, backendEnv, databaseUrl, root } = require("./environment.cjs");
const { spawn } = require("node:child_process");
const path = require("node:path");
// The schema, middleware and API routes are the unchanged application. Only its process environment differs.
const child = spawn(
  process.execPath,
  [
    "--import",
    path.join(root, "apps/frontend-expo/node_modules/tsx/dist/loader.mjs"),
    "-e",
    "import('./src/index.ts').then(m => (m.default.default ?? m.default).listen(4318, '127.0.0.1', () => console.log('Expo live API listening on 4318')));",
  ],
  {
    cwd: backend,
    stdio: "inherit",
    env: {
      ...process.env,
      ...backendEnv,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      REDIS_URL: "redis://127.0.0.1:56379",
      NODE_ENV: "development",
      SKIP_SERVER_START: "true",
      EXTRA_CORS_ORIGINS: "http://localhost:8084,http://127.0.0.1:8084",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_CHAT_IDS: "",
      BRAINTRUST_API_KEY: "",
      TSX_TSCONFIG_PATH: path.join(backend, "tsconfig.json"),
    },
  },
);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
