import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { appRoot, buildEnvironment, releaseRoot } from "./configuration";

const action = process.argv[2];
const keyDirectory = path.join(releaseRoot, "appstore-connect");
const keyPath = path.join(keyDirectory, "AuthKey_RRBPAL9WF4.p8");
const issuerId = "f2738712-afe4-496a-8317-a78e28ed722c";
const keyId = "RRBPAL9WF4";

function fail(message: string): never {
  throw new Error(message);
}

function ipaPath(): string {
  const value = process.argv[3];
  if (!value) fail(`Usage: ${process.argv[1]} ${action} /absolute/or/release-relative/path.ipa`);
  const resolved = path.resolve(appRoot, value);
  if (!resolved.startsWith(`${releaseRoot}${path.sep}`)) {
    fail(`TestFlight artifacts must stay under ${releaseRoot}.`);
  }
  if (!fs.existsSync(resolved)) fail(`IPA not found: ${resolved}`);
  return resolved;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { cwd: appRoot, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!action || !["build", "validate", "submit"].includes(action)) {
  fail("Use build, validate, or submit.");
}

if (action === "build") {
  fs.mkdirSync(keyDirectory, { recursive: true });
  if (!fs.existsSync(keyPath)) fail(`Missing App Store Connect key: ${keyPath}`);
  const output = path.resolve(
    appRoot,
    process.argv[3] ?? path.join(".release", `testflight-${new Date().toISOString().replace(/[:.]/g, "-")}`, "tracking.so.ipa"),
  );
  if (!output.startsWith(`${releaseRoot}${path.sep}`)) fail(`TestFlight artifacts must stay under ${releaseRoot}.`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const env = buildEnvironment();
  delete env.SDKROOT;
  run(
    "pnpm",
    [
      "dlx", "eas-cli@24.0.0", "build", "--platform", "ios", "--profile", "production",
      "--local", "--non-interactive", "--freeze-credentials", "--output", output,
    ],
    env,
  );
  console.log(`TestFlight IPA: ${output}`);
} else {
  if (!fs.existsSync(keyPath)) fail(`Missing App Store Connect key: ${keyPath}`);
  const mode = fs.statSync(keyPath).mode & 0o777;
  if (mode !== 0o600) fail(`App Store Connect key must be mode 600: ${keyPath}`);
  const ipa = ipaPath();
  const developerDir = process.env.DEVELOPER_DIR && !process.env.DEVELOPER_DIR.endsWith("/CommandLineTools")
    ? process.env.DEVELOPER_DIR
    : "/Applications/Xcode.app/Contents/Developer";
  const altool = path.resolve(
    developerDir,
    "..", "SharedFrameworks", "ContentDelivery.framework", "Versions", "A", "Resources", "altool",
  );
  if (!fs.existsSync(altool)) fail(`Apple altool not found: ${altool}`);
  const env = { ...process.env, API_PRIVATE_KEYS_DIR: keyDirectory, DEVELOPER_DIR: developerDir };
  const args = action === "validate"
    ? ["--validate-app", ipa]
    : ["--upload-package", ipa, "--wait"];
  run(altool, [...args, "--apiKey", keyId, "--apiIssuer", issuerId, "--output-format", "json"], env);
}
