const path = require("node:path");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../..");
const backend = path.join(root, "apps/backend-node");
const backendRequire = createRequire(path.join(backend, "package.json"));
const dotenv = backendRequire("dotenv");
const backendEnv = dotenv.parse(fs.readFileSync(path.join(backend, ".env")));
const frontendEnv = dotenv.parse(
  fs.readFileSync(path.join(root, "apps/frontend-vite/.env")),
);
const testEnvPath = path.join(root, "e2e-tests/.env");
const testEnv = fs.existsSync(testEnvPath)
  ? dotenv.parse(fs.readFileSync(testEnvPath))
  : {};
const legacyTest = fs.readFileSync(
  path.join(root, "e2e-tests/tests/full.spec.ts"),
  "utf8",
);
const testEmail =
  process.env.APP_TEST_USER_EMAIL ||
  testEnv.APP_TEST_USER_EMAIL ||
  legacyTest.match(/APP_TEST_USER_EMAIL\s*\|\|\s*["']([^"']+)["']/)?.[1];
const testPassword =
  process.env.APP_TEST_USER_PASSWORD ||
  testEnv.APP_TEST_USER_PASSWORD ||
  legacyTest.match(/APP_TEST_USER_PASSWORD\s*\|\|\s*["']([^"']+)["']/)?.[1];
const databaseUrl = `postgresql://${encodeURIComponent(require("node:os").userInfo().username)}@127.0.0.1:55432/tracking_expo_e2e`;
module.exports = {
  root,
  backend,
  backendRequire,
  testEmail,
  testPassword,
  databaseUrl,
  backendEnv,
  frontendEnv,
};
