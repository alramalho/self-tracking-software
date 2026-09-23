// Fixture-only iOS acceptance. Start e2e/server.ts on 4319 and Expo Metro on
// 8085 before running this script; it never contacts production services.
const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { existsSync, mkdirSync, readdirSync, statSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const device = process.env.E2E_IOS_DEVICE;
const iosApp = process.env.E2E_IOS_APP;
const maestro = process.env.MAESTRO_BIN || "maestro";
const theme = process.env.E2E_THEME || "DARK";
const image = process.env.E2E_PHOTO_FIXTURE || path.join(root, "assets/icon.png");
const output = path.join(root, "test-results-native-ios", `offline-photo-${theme}-${Date.now()}`);
const api = "http://127.0.0.1:4319";
const env = {
  ...process.env,
  MAESTRO_CLI_NO_ANALYTICS: "1",
  MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true",
  DEVELOPER_DIR: process.env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer",
};

async function request(endpoint, body) {
  const response = await fetch(`${api}${endpoint}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, 200, `${endpoint} returned ${response.status}`);
  return response.json();
}

async function waitFor(url, headers = {}) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Fixture service is unavailable: ${url}`);
}

function runPhase(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(maestro, ["--device", device, "test", "--test-output-dir", output,
      `e2e/native/${file}`], { cwd: root, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() :
      reject(new Error(`${file} failed (${code}); inspect ${output}`)));
  });
}

function stagedPhotoFiles() {
  const container = execFileSync("xcrun", ["simctl", "get_app_container", device,
    "so.tracking.app", "data"], { env, encoding: "utf8" }).trim();
  const base = path.join(container, "Documents", "offline-logs");
  if (!existsSync(base)) return [];
  return readdirSync(base).flatMap((logId) => {
    const folder = path.join(base, logId);
    return statSync(folder).isDirectory()
      ? readdirSync(folder).map((name) => path.join(folder, name)) : [];
  });
}

function verifyUploadedState(state, attemptsBeforeReconnect) {
  const logs = state.entries.filter((entry) => entry.description === "Offline photo proof");
  assert.equal(logs.length, 1, "The uncertain response must leave exactly one activity.");
  assert.equal(logs[0].quantity, 7);
  assert.equal(logs[0].imageUrls?.length, 1, "The activity must have exactly one uploaded photo.");
  const attempts = state.requests.filter((request) =>
    request.path === "/activities/log-activity" &&
    request.body.description === "Offline photo proof");
  assert.ok(attempts.length - attemptsBeforeReconnect >= 2,
    "The lost log response must trigger a second online attempt.");
  const requestIds = new Set(attempts.map((attempt) => attempt.body.clientRequestId));
  assert.equal(requestIds.size, 1);
  const requestId = [...requestIds][0];
  assert.ok(requestId, "The log needs a stable client request ID.");
  const uploads = state.requests.filter((request) =>
    request.method === "PUT" && request.path === `/activities/activity-entries/${logs[0].id}/photo`);
  assert.ok(uploads.length >= 1, "The staged photo must upload after reconnection.");
  assert.ok(uploads.every((upload) => upload.body.clientRequestId === requestId),
    "Photo retries must use the same request ID as the log.");
  assert.ok(uploads.some((upload) => upload.body.uploadedPhotos?.length === 1 &&
    upload.body.uploadedPhotos[0].size > 0 &&
    String(upload.body.uploadedPhotos[0].type).startsWith("image/")),
    "At least one actual image file must reach the fixture API.");
}

async function main() {
  assert.ok(device, "Set E2E_IOS_DEVICE to the selected booted simulator.");
  assert.ok(iosApp && existsSync(path.join(iosApp, "Info.plist")),
    "Set E2E_IOS_APP to the current fixture simulator .app.");
  assert.ok(existsSync(image) && statSync(image).size > 0,
    "Set E2E_PHOTO_FIXTURE to a non-sensitive local image.");
  assert.ok(["DARK", "LIGHT"].includes(theme));
  execFileSync(maestro, ["--version"], { env, stdio: "pipe" });
  const bundleId = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier",
    path.join(iosApp, "Info.plist")], { encoding: "utf8" }).trim();
  assert.equal(bundleId, "so.tracking.app");
  const booted = JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "booted", "--json"],
    { env, encoding: "utf8" })).devices;
  assert.ok(Object.values(booted).flat().some((simulator) =>
    simulator.udid === device && simulator.state === "Booted"), "Simulator must already be booted.");
  await Promise.all([waitFor(`${api}/__state`), waitFor("http://127.0.0.1:8085/status")]);
  await waitFor("http://127.0.0.1:8085/", {
    "expo-platform": "ios", accept: "application/expo+json",
  });
  mkdirSync(output, { recursive: true });
  await request("/__reset", {});
  const themeResponse = await fetch(`${api}/users/user`, {
    method: "PATCH",
    headers: { Authorization: "Bearer local-e2e-token", "Content-Type": "application/json" },
    body: JSON.stringify({ themeMode: theme }),
  });
  assert.equal(themeResponse.status, 200);
  try {
    execFileSync("xcrun", ["simctl", "uninstall", device, bundleId], { env, stdio: "pipe" });
  } catch {}
  execFileSync("xcrun", ["simctl", "install", device, iosApp], { env, stdio: "inherit" });
  execFileSync("xcrun", ["simctl", "addmedia", device, image], { env, stdio: "inherit" });
  execFileSync("xcrun", ["simctl", "launch", device, bundleId,
    "-EXDevMenuIsOnboardingFinished", "YES",
    "-EXDevMenuShowsAtLaunch", "NO",
    "-EXDevMenuShowFloatingActionButton", "NO"], { env, stdio: "inherit" });
  execFileSync("xcrun", ["simctl", "openurl", device,
    `trackingso://expo-development-client/?url=${encodeURIComponent("http://127.0.0.1:8085")}`], { env, stdio: "inherit" });
  await runPhase("offline-cache-ios.yaml");
  await request("/__offline", { enabled: true });
  await runPhase("offline-photo-log-ios.yaml");
  await runPhase("offline-photo-restart-ios.yaml");
  const staged = stagedPhotoFiles();
  assert.equal(staged.length, 1, "One photo must remain staged in Documents after restart.");
  assert.ok(statSync(staged[0]).size > 0, "The staged photo must have bytes.");
  const beforeReconnect = await request("/__state");
  assert.equal(beforeReconnect.entries.filter((entry) =>
    entry.description === "Offline photo proof").length, 0,
  "The offline log must be stored locally before the server receives it.");
  const attemptsBeforeReconnect = beforeReconnect.requests.filter((request) =>
    request.path === "/activities/log-activity" &&
    request.body.description === "Offline photo proof").length;
  await request("/__offline", { enabled: false, loseNextLogResponse: true });
  await runPhase("offline-sync-ios.yaml");
  verifyUploadedState(await request("/__state"), attemptsBeforeReconnect);
  console.log(`Offline photo staged, survived restart and uploaded once after an uncertain response. Evidence: ${output}`);
}

module.exports = { verifyUploadedState };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
