const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { mkdirSync, openSync, closeSync, existsSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const ios = process.argv.includes("--ios");
const activityEditorFlow = process.argv.includes("--activity-editor");
const healthFlow = process.argv.includes("--health");
const healthVitalsFlow = process.argv.includes("--health-vitals");
const assistanceFlow = process.argv.includes("--assistance");
const flexibleFlow = process.argv.includes("--flexible");
const profileGridFlow = process.argv.includes("--profile-grid");
const sessionsFlow = process.argv.includes("--sessions");
const onboardingKeyboardFlow = process.argv.includes("--onboarding-keyboard");
const onboardingFlow = process.argv.includes("--onboarding") || onboardingKeyboardFlow;
const reactionGlassFlow = process.argv.includes("--reaction-glass");
const loggerAppearanceFlow = process.argv.includes("--logger-appearance");
const followUpsFlow = process.argv.includes("--follow-ups");
const voiceNoteFlow = process.argv.includes("--voice-note");
const loggerFlow = process.argv.includes("--logger") || loggerAppearanceFlow || followUpsFlow;
const polishFlow = process.argv.includes("--polish");
const yearSearchFlow = process.argv.includes("--year-search");
const wrappedFlow = process.argv.includes("--wrapped") || yearSearchFlow;
const profileDesignFlow = process.argv.includes("--profile-design");
const coachActionsFlow = process.argv.includes("--coach-actions");
const inlineCoachFlow = process.argv.includes("--inline-coach");
const planLinksFlow = process.argv.includes("--plan-links");
const commentsFlow = process.argv.includes("--comments");
const messagesFlow = process.argv.includes("--messages");
const notificationsFlow = process.argv.includes("--notifications");
const reactionPeopleFlow = process.argv.includes("--reaction-people");
const reactionDesign = process.argv.includes("--reactions");
const timelineDesign = process.argv.includes("--timeline-design");
const output = path.join(
  root,
  ios ? "test-results-native-ios" : "test-results-native",
);
const sdk =
  process.env.ANDROID_HOME || path.join(os.homedir(), "Library/Android/sdk");
const adb = path.join(sdk, "platform-tools/adb");
const maestro = process.env.MAESTRO_BIN || "maestro";
const apk =
  process.env.E2E_ANDROID_APK ||
  path.join(root, "android/app/build/outputs/apk/debug/app-debug.apk");
const iosApp = process.env.E2E_IOS_APP;
const servers = [];
let testProcess;
function cleanup() {
  if (testProcess && testProcess.exitCode === null) testProcess.kill("SIGTERM");
  for (const server of servers) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    cleanup();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
const env = {
  ...process.env,
  ...(ios && !process.env.DEVELOPER_DIR && existsSync("/Applications/Xcode.app")
    ? { DEVELOPER_DIR: "/Applications/Xcode.app/Contents/Developer" }
    : {}),
  ANDROID_HOME: sdk,
  MAESTRO_CLI_NO_ANALYTICS: "1",
  MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true",
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function startServer(name, args, extraEnv = {}) {
  const log = openSync(path.join(output, `${name}.log`), "w");
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...env, ...extraEnv },
    stdio: ["ignore", log, log],
    detached: true,
  });
  closeSync(log);
  child.on("error", (error) => {
    child.startError = error;
  });
  servers.push(child);
  return child;
}

async function waitFor(url, child, headers = {}) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.startError || child.exitCode !== null)
      throw new Error(`Test server failed. See ${output}`, {
        cause: child.startError,
      });
    try {
      if ((await fetch(url, { headers, signal: AbortSignal.timeout(1000) })).ok)
        return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}. See ${output}`);
}

async function run() {
  if (ios && (!iosApp || !existsSync(path.join(iosApp, "Info.plist"))))
    throw new Error("Set E2E_IOS_APP to the extracted simulator .app bundle.");
  if (!ios && !existsSync(apk))
    throw new Error(
      "Build the Android development APK first with pnpm android, or set E2E_ANDROID_APK.",
    );
  execFileSync(maestro, ["--version"], { env, stdio: "pipe" });
  const devices = ios
    ? Object.entries(
        JSON.parse(
          execFileSync(
            "xcrun",
            ["simctl", "list", "devices", "booted", "--json"],
            {
              env,
              encoding: "utf8",
            },
          ),
        ).devices,
      )
        .filter(([runtime]) => runtime.includes(".iOS-"))
        .flatMap(([, rows]) =>
          rows
            .filter((row) => row.isAvailable && row.state === "Booted")
            .map((row) => row.udid),
        )
    : execFileSync(adb, ["devices"], { encoding: "utf8" })
        .split("\n")
        .filter((line) => /^emulator-\S+\s+device$/.test(line.trim()))
        .map((line) => line.split(/\s+/)[0]);
  const device =
    (ios ? process.env.E2E_IOS_DEVICE : process.env.E2E_ANDROID_DEVICE) ||
    devices[0];
  if (!device || !devices.includes(device))
    throw new Error(
      `Start an ${ios ? "iOS simulator" : "Android emulator"} first. This fixture runner only targets simulators/emulators.`,
    );
  for (const port of [4319, 8085]) {
    let occupied = false;
    try {
      await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(500),
      });
      occupied = true;
    } catch {}
    if (occupied)
      throw new Error(
        `Port ${port} is in use. Stop the existing test server before running native E2E.`,
      );
  }
  mkdirSync(output, { recursive: true });
  const api = startServer("api", ["--import", "tsx", "e2e/server.ts"], {
    E2E_API_PORT: "4319",
  });
  const metro = startServer(
    "metro",
    ["node_modules/expo/bin/cli", "start", "--clear", "--port", "8085"],
    {
      EXPO_PUBLIC_E2E: "true",
      EXPO_PUBLIC_BACKEND_URL: "http://127.0.0.1:4319",
      EXPO_NO_TELEMETRY: "1",
      REACT_NATIVE_PACKAGER_HOSTNAME: "127.0.0.1",
    },
  );
  await Promise.all([
    waitFor("http://127.0.0.1:4319/__state", api),
    waitFor("http://127.0.0.1:8085/status", metro),
  ]);
  if (healthFlow || healthVitalsFlow) {
    const seeded = await fetch("http://127.0.0.1:4319/__health-batch", { method: "POST", headers: { Authorization: "Bearer local-e2e-token" } });
    assert.equal(seeded.status, 200);
    await fetch("http://127.0.0.1:4319/users/user", { method: "PATCH", headers: { Authorization: "Bearer local-e2e-token", "Content-Type": "application/json" }, body: JSON.stringify({ themeMode: process.env.E2E_THEME ?? "DARK" }) });
  }
  if (flexibleFlow) {
    const response = await fetch("http://127.0.0.1:4319/__follow-through", {method:"POST",headers:{Authorization:"Bearer local-e2e-token","Content-Type":"application/json"},body:JSON.stringify({flexibleWeekly:true})});
    assert.equal(response.status,200);
    await fetch("http://127.0.0.1:4319/users/user", {method:"PATCH",headers:{Authorization:"Bearer local-e2e-token","Content-Type":"application/json"},body:JSON.stringify({themeMode:process.env.E2E_THEME ?? "DARK"})});
  }
  if (profileGridFlow) {
    for (const endpoint of ["__polish", "__follow-through"]) {
      const response = await fetch(`http://127.0.0.1:4319/${endpoint}`, {method:"POST",headers:{Authorization:"Bearer local-e2e-token","Content-Type":"application/json"},body:JSON.stringify({theme:process.env.E2E_THEME ?? "DARK",profileGrid:true})});
      assert.equal(response.status,200);
    }
  }
  if (sessionsFlow) {
    const response = await fetch("http://127.0.0.1:4319/__follow-through", {method:"POST",headers:{Authorization:"Bearer local-e2e-token"}});
    assert.equal(response.status, 200);
  }
  if (reactionGlassFlow) {
    for (const endpoint of ["__timeline-design", "__reaction-people"]) {
      const response = await fetch(`http://127.0.0.1:4319/${endpoint}`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({kind:"external"})});
      assert.equal(response.status,200);
    }
    await fetch("http://127.0.0.1:4319/users/user", {method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer local-e2e-token"},body:JSON.stringify({themeMode:process.env.E2E_THEME ?? "DARK"})});
  }
  if (polishFlow) {
    const seeded = await fetch("http://127.0.0.1:4319/__polish", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({theme:process.env.E2E_THEME ?? "DARK",profileGrid:true})});
    assert.equal(seeded.status,200);
  }
  if (followUpsFlow) {
    await fetch("http://127.0.0.1:4319/metrics", {method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer local-e2e-token"},body:JSON.stringify({title:"Productivity",emoji:"📈"})});
  }
  if (loggerFlow || voiceNoteFlow || onboardingFlow || sessionsFlow || assistanceFlow || activityEditorFlow) {
    const seeded = await fetch("http://127.0.0.1:4319/users/user", {method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer local-e2e-token"},body:JSON.stringify({themeMode:process.env.E2E_THEME ?? "DARK",themeBaseColor:"AMBER"})});
    assert.equal(seeded.status,200);
  }
  if (wrappedFlow) {
    const seeded = await fetch("http://127.0.0.1:4319/__wrapped", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themeMode: process.env.E2E_THEME ?? "DARK" }) });
    assert.equal(seeded.status, 200, "Wrapped fixtures must be seeded before the app caches queries.");
  }
  if (yearSearchFlow) {
    assert.equal((await fetch("http://127.0.0.1:4319/__people-search", {method:"POST"})).status, 200);
  }
  await waitFor("http://127.0.0.1:8085/", metro, {
    "expo-platform": ios ? "ios" : "android",
    accept: "application/expo+json",
  });
  if (ios) {
    const bundleId = execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", "Print :CFBundleIdentifier", path.join(iosApp, "Info.plist")],
      { encoding: "utf8" },
    ).trim();
    assert.equal(
      bundleId,
      "so.tracking.app",
      "Unexpected iOS application bundle.",
    );
    // Reset only this app on the selected local simulator.
    try {
      execFileSync("xcrun", ["simctl", "uninstall", device, bundleId], {
        env,
        stdio: "pipe",
      });
    } catch {}
    execFileSync("xcrun", ["simctl", "install", device, iosApp], {
      env,
      stdio: "inherit",
    });
    // Keep development-client controls from covering the app's settings button.
    execFileSync(
      "xcrun",
      [
        "simctl",
        "launch",
        device,
        bundleId,
        "-EXDevMenuIsOnboardingFinished",
        "YES",
        "-EXDevMenuShowsAtLaunch",
        "NO",
        "-EXDevMenuShowFloatingActionButton",
        "NO",
      ],
      { env, stdio: "inherit" },
    );
    execFileSync(
      "xcrun",
      [
        "simctl",
        "openurl",
        device,
        "trackingso://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8085",
      ],
      { env, stdio: "inherit" },
    );
  } else {
    for (const port of [4319, 8085])
      execFileSync(adb, [
        "-s",
        device,
        "reverse",
        `tcp:${port}`,
        `tcp:${port}`,
      ]);
    execFileSync(adb, ["-s", device, "install", "-r", apk], {
      stdio: "inherit",
    });
    execFileSync(
      adb,
      ["-s", device, "shell", "pm", "clear", "so.tracking.app"],
      { stdio: "inherit" },
    );
  }
  await new Promise((resolve, reject) => {
    const test = spawn(
      maestro,
      [
        "--device",
        device,
        "test",
        "--test-output-dir",
        output,
        onboardingKeyboardFlow && ios
          ? "e2e/native/onboarding-keyboard-ios.yaml"
          : activityEditorFlow && ios
          ? "e2e/native/activity-editor-ios.yaml"
          : healthVitalsFlow && ios
          ? "e2e/native/health-vitals-ios.yaml"
          : healthFlow && ios
          ? "e2e/native/health-ios.yaml"
          : assistanceFlow && ios
          ? "e2e/native/assistance-ios.yaml"
          : flexibleFlow && ios
          ? "e2e/native/flexible-ios.yaml"
          : profileGridFlow && ios
          ? "e2e/native/profile-grid-ios.yaml"
          : sessionsFlow && ios
          ? "e2e/native/sessions-ios.yaml"
          : onboardingFlow && ios
          ? "e2e/native/onboarding-ios.yaml"
          : yearSearchFlow && ios
          ? "e2e/native/year-search-ios.yaml"
          : reactionGlassFlow && ios
          ? "e2e/native/reaction-glass-ios.yaml"
          : loggerAppearanceFlow && ios
          ? "e2e/native/logger-appearance-ios.yaml"
          : voiceNoteFlow && ios
          ? "e2e/native/voice-note-ios.yaml"
          : followUpsFlow && ios
          ? "e2e/native/follow-ups-ios.yaml"
          : loggerFlow && ios
          ? "e2e/native/logger-ios.yaml"
          : polishFlow && ios
          ? "e2e/native/polish-ios.yaml"
          : wrappedFlow && ios
          ? "e2e/native/wrapped-ios.yaml"
          : reactionPeopleFlow && ios
          ? "e2e/native/reaction-people-ios.yaml"
          : profileDesignFlow && ios
          ? "e2e/native/profile-design-ios.yaml"
          : coachActionsFlow && ios
          ? "e2e/native/coach-actions-ios.yaml"
          : inlineCoachFlow && ios
          ? "e2e/native/inline-coach-ios.yaml"
          : planLinksFlow && ios
          ? "e2e/native/plan-links-ios.yaml"
          : commentsFlow && ios
            ? "e2e/native/comments-ios.yaml"
              : messagesFlow && ios
              ? "e2e/native/messages-ios.yaml"
              : notificationsFlow && ios
                ? "e2e/native/notifications-ios.yaml"
              : reactionDesign && ios
                ? "e2e/native/reactions-ios.yaml"
                : timelineDesign && ios
                  ? "e2e/native/timeline-design-ios.yaml"
                  : ios
                    ? "e2e/native/parity-ios.yaml"
                    : "e2e/native/parity.yaml",
      ],
      { cwd: root, env, stdio: "inherit" },
    );
    testProcess = test;
    test.on("error", reject);
    test.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Native E2E failed (${code}). See ${output}`)),
    );
  });
  const state = await (await fetch("http://127.0.0.1:4319/__state")).json();
  if (activityEditorFlow) {
    const saves = state.requests.filter(r => r.method === "POST" && r.path === "/activities/upsert");
    assert.equal(saves.length, 1);
    assert.equal(saves[0].body.measure, "meters");
    assert.equal(saves[0].body.colorHex, null);
    assert.deepEqual(saves[0].body.measureConversion, { operator: "multiply", factor: 1000 });
    assert.equal(state.requests.filter(r => r.method === "DELETE").length, 0);
    console.log(`Native activity editor, color palette, keyboard, conversion and delete cancellation passed in ${state.user.themeMode}.`);
    return;
  }
  if (healthFlow) {
    const decisions = state.requests.filter(r => r.method === "POST" && r.path.endsWith("/reconcile"));
    assert.deepEqual(decisions.map(r => r.body), [
      { decisions: [{ healthWorkoutId: "health-run", action: "link_keep", activityEntryId: "entry-run", shareHealthData: false }] },
      { decisions: [{ healthWorkoutId: "health-strength", action: "link_keep", activityEntryId: "entry-strength", shareHealthData: false }] },
    ]);
    const syncs = state.requests.filter(r => r.method === "POST" && r.path === "/health/apple/sync");
    assert.ok(syncs.length > 0, "Native HealthKit must prepare and upload after authorization");
    assert.deepEqual(syncs[0].body.requestedDataTypes, [
      "workout",
      "sleep_analysis",
      "heart_rate",
      "workout_effort_score",
      "estimated_workout_effort_score",
    ]);
    assert.equal(syncs.at(-1).body.isFinalBatch, true);
    console.log(`Native Health authorization, sync, review and sleep breakdown passed in ${state.user.themeMode}.`);
    return;
  }
  if (healthVitalsFlow) {
    console.log(`Native Apple Watch workout-vitals details passed in ${state.user.themeMode}. Screenshots: ${output}`);
    return;
  }
  if (notificationsFlow) {
    assert.ok(state.requests.some((r) => r.method === "GET" && r.path === "/notifications"), "Notifications screen must load the inbox");
    console.log(`Native notifications inbox and deep-link route passed in ${state.user.themeMode}. Real APNs registration requires a physical device.`);
    return;
  }
  if (assistanceFlow) {
    const snapshot=await(await fetch("http://127.0.0.1:4319/follow-through",{headers:{Authorization:"Bearer local-e2e-token"}})).json();
    const support=snapshot.state.supports.fitness;
    assert.equal(support.mode,"TIMED");
    assert.deepEqual(support.weekdays,[3]);
    assert.equal(support.time,"18:00");
    assert.equal(support.preferences.reminder,true);
    assert.equal(support.preferences.reminderMinutes,30);
    assert.equal(support.preferences.weeklyReview,true);
    assert.equal(support.preferences.reviewDay,0);
    assert.equal(support.preferences.checkIn,false);
    assert.equal(state.requests.filter(r=>r.method==="PUT"&&r.path==="/follow-through/plans/fitness").length,3);
    console.log(`Native assistance sheets and three independent saves passed in ${state.user.themeMode}.`);
    return;
  }
  if (flexibleFlow) {
    assert.equal(state.requests.filter(r=>r.method==="POST" && (r.path.startsWith("/follow-through/sessions") || r.path==="/activities/log-activity")).length,0);
    console.log(`Native flexible week uses the original logger without session writes in ${state.user.themeMode}.`);
    return;
  }
  if (profileGridFlow) {
    assert.equal(state.requests.filter(r=>r.path==="/activities/log-activity").length,0);
    console.log(`Native profile glimmer, compact grid, fire markers and legend passed in ${state.user.themeMode}. Captures: ${output}`);
    return;
  }
  if (sessionsFlow) {
    assert.ok(state.requests.some(r=>r.path.endsWith("/timer") && r.body.action === "START"));
    assert.ok(state.requests.some(r=>r.path.endsWith("/timer") && r.body.action === "FINISH"));
    assert.equal(state.requests.filter(r=>r.path==="/activities/log-activity").length,0);
    assert.ok(state.requests.some(r=>r.path.endsWith("/outcome") && r.body.outcome === "SKIPPED"));
    assert.ok(state.requests.some(r=>r.path==="/follow-through/calendar"));
    if (ios) {
      const calendarDb = path.join(os.homedir(), "Library/Developer/CoreSimulator/Devices", process.env.E2E_IOS_DEVICE, "data/Library/Calendar/Calendar.sqlitedb");
      const rows = JSON.parse(execFileSync("python3", ["-c", "import sqlite3,json,sys; c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); print(json.dumps(c.execute(\"select url,(end_date-start_date)/60 from CalendarItem where description like 'tracking.so calendar sync%'\").fetchall()))", calendarDb], {encoding:"utf8"}));
      assert.equal(rows.filter(row=>row[0]==="trackingso://session/session-next" && row[1]===20).length, 1, "Next session must exist exactly once in the actual iOS calendar");
      assert.equal(rows.filter(row=>row[0]==="trackingso://session/session-check").length, 0, "Skipped session must not remain in the actual iOS calendar");
    }
    console.log(`Native coach card, 20-week streak, persistent timer, explicit outcome and persisted calendar events passed in ${state.user.themeMode}.`);
    return;
  }
  if (onboardingFlow) {
    assert.equal(state.plans.length, 2);
    assert.equal(state.requests.filter(r => r.path.endsWith("/onboarding/interview")).length, onboardingKeyboardFlow ? 1 : 5);
    assert.equal(state.requests.filter(r => r.path.endsWith("/onboarding/draft") || r.path.endsWith("/onboarding/finish")).length, 0);
    if (onboardingKeyboardFlow) {
      const transcription = state.requests.find(
        r => r.method === "POST" && r.path === "/ai/transcribe",
      );
      assert.equal(transcription?.body.audio_format, "m4a");
      assert.ok(
        transcription?.body.uploadedAudio?.size > 0,
        "Native dictation must upload a non-empty recording",
      );
    }
    console.log(`Native ${onboardingKeyboardFlow ? "onboarding keyboard and first gate" : "settings drawers and all five AI gates"}, with preview isolation, passed in ${state.user.themeMode}.`);
    return;
  }
  if (reactionGlassFlow) {
    assert.equal(state.requests.filter(r => r.path.endsWith("/modify-reactions")).length, 0);
    console.log(`Native glass reaction rendering and viewer checks passed in ${state.user.themeMode}.`);
    return;
  }
  if (loggerAppearanceFlow) {
    assert.equal(state.requests.filter(r => r.path === "/activities/log-activity").length, 0);
    console.log("Native light drawer/status-bar appearance and dismissal smoke check passed.");
    return;
  }
  if (voiceNoteFlow) {
    assert.equal(state.requests.filter(r => r.path === "/activities/log-activity").length, 0);
    console.log(`Native dark voice-note entry-point capture passed in ${state.user.themeMode}. Screenshots: ${output}`);
    return;
  }
  if (loggerFlow) {
    const log = state.requests.find(r => r.path === "/activities/log-activity");
    assert.equal(Number(log.body.quantity), 7);
    assert.equal(log.body.description, "Native calendar activity");
    assert.equal(log.body.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (followUpsFlow) {
      const effort = state.requests.find(r => r.method === "PUT" && r.body.difficulty === "hard");
      assert.equal(effort.body.privateNotes, "Coach should know: Poor sleep.\nNeed more rest");
      assert.equal(state.requests.filter(r => r.path === "/metrics/entries" && r.method === "POST").length, 3);
      assert.ok(state.requests.some(r => r.path === "/metrics/entries/today-note" && r.body.note === "Feeling better now"));
    }
    console.log(`Native calendar, presets, time picker, dismissal and logging flow passed in ${state.user.themeMode}. Screenshots: ${output}`);
    return;
  }

  if (polishFlow) {
    assert.ok(state.plans[0].notes.includes("Training roadmap"), "Cancelling notes must preserve the original.");
    assert.equal(state.requests.filter(r => r.path === "/plans/upsert" && r.method === "POST").length, 0);
    console.log(`Native plan islands, notes preview/cancel, metric reliability and Home/profile reveal flow passed in ${state.user.themeMode}. Screenshots: ${output}`);
    return;
  }
  if (wrappedFlow) {
    console.log(`Native wrapped stories, badge drawer, Home return-to-top and share sheet passed. Screenshots: ${output}`);
    return;
  }
  if (profileDesignFlow) {
    assert.equal(state.user.accountStats.totalPoints, 600);
    console.log(`Native profile layout, badge animations, settings and progress interactions passed in both themes. Screenshots: ${output}`);
    return;
  }
  if (coachActionsFlow) {
    assert.ok(state.requests.some(r => r.path.endsWith("/accept-activity-log-proposal")));
    console.log(`Native compact coach actions, acceptance and both themes passed. Screenshots: ${output}`);
    return;
  }
  if (inlineCoachFlow) {
    assert.ok(state.requests.some(r => r.path === "/plans/scheduled"));
    console.log(`Native inline references, previews, session details, back navigation and both themes passed. Screenshots: ${output}`);
    return;
  }
  if (planLinksFlow) {
    assert.ok(state.requests.some((r) => r.path === "/plans/fitness"));
    assert.ok(state.requests.some((r) => r.path === "/plans/scheduled"));
    console.log(
      `Native coach overview plan links, activity preview and both themes passed. Screenshots: ${output}`,
    );
    return;
  }
  if (commentsFlow) {
    const sent = state.requests.filter(
      (r) => r.method === "POST" && r.path.endsWith("/comments"),
    );
    assert.deepEqual(
      sent.map((r) => r.body.text),
      ["Native comment draft", "Light mode comment"],
    );
    assert.ok(
      sent.every(
        (r) => r.path === "/activities/activity-entries/joint-b/comments",
      ),
    );
    console.log(
      `Native comments, drafts, keyboard, dragging and both themes passed. Screenshots: ${output}`,
    );
    return;
  }
  if (messagesFlow) {
    assert.ok(
      state.requests.some(
        (r) =>
          r.path === "/chats/coach-main/messages/stream" &&
          r.body.message === "Native coach test" &&
          r.body.coachVersion === "v2",
      ),
    );
    assert.ok(
      state.requests.some(
        (r) =>
          r.path === "/chats/direct-sam/messages" &&
          r.body.message === "See you then",
      ),
    );
    console.log(
      `Native inbox, coach streaming, keyboard, direct messages and themes passed. Screenshots: ${output}`,
    );
    return;
  }
  if (reactionPeopleFlow) {
    assert.equal(state.requests.filter(request => request.path.endsWith("/modify-reactions")).length, 0);
    console.log(`Native reaction viewer, filters, profile navigation and glass badges passed in both themes. Screenshots: ${output}`);
    return;
  }
  if (reactionDesign) {
    const mutations = state.requests.filter((request) =>
      request.path.endsWith("/modify-reactions"),
    );
    assert.deepEqual(
      mutations.map((request) => request.path),
      Array(4).fill("/activities/activity-entries/joint-b/modify-reactions"),
    );
    assert.deepEqual(
      mutations.map((request) => request.body.reactions[0].operation),
      ["add", "remove", "add", "remove"],
    );
    console.log(
      `Native reaction island, dismissal and add/remove persistence passed. Screenshots: ${output}`,
    );
    return;
  }
  if (timelineDesign) {
    assert.equal(
      state.entries.filter(
        (entry) => entry.id === "joint-a" || entry.id === "joint-b",
      ).length,
      2,
    );
    console.log(
      `Native timeline design and photo dismissal passed. Screenshots: ${output}`,
    );
    return;
  }
  assert.equal(
    state.entries.filter(
      (entry) =>
        entry.description === "Native parity run" && entry.quantity === 7,
    ).length,
    1,
  );
  assert.ok(
    state.metricEntries.some(
      (entry) =>
        entry.metricId === "energy" &&
        entry.rating === 5 &&
        entry.description === "Native check-in",
    ),
  );
  assert.ok(
    state.metricEntries.some(
      (entry) => entry.metricId === "mood" && entry.rating === 4,
    ),
  );
  console.log(
    `Native UI and fixture persistence passed. Screenshots: ${output}`,
  );
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
