import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
import type { Command, Distribution, PublicEnvironment } from "./types";

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const releaseRoot = path.join(appRoot, ".release");
export const run: Command = (command, args, env = process.env) =>
  execFileSync(command, args, { cwd: appRoot, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function publicEnvironment(file = process.env.IPHONE_ENV_FILE ?? path.join(releaseRoot, "production.env.json")): PublicEnvironment {
  const values = JSON.parse(fs.readFileSync(file, "utf8"));
  const backend = values.EXPO_PUBLIC_BACKEND_URL;
  const clerk = values.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (backend !== "https://api.tracking.so" || typeof clerk !== "string" || !clerk.startsWith("pk_live_")) {
    throw new Error("iPhone releases require https://api.tracking.so and the production Clerk publishable key.");
  }
  if (values.EXPO_PUBLIC_E2E) throw new Error("Fixture authentication is forbidden in iPhone releases.");
  return { EXPO_PUBLIC_BACKEND_URL: backend, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerk };
}

export function buildEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...publicEnvironment(), EXPO_NO_DOTENV: "1", EXPO_NO_TELEMETRY: "1", NODE_ENV: "production" };
  delete env.EXPO_PUBLIC_E2E;
  const selected = process.env.DEVELOPER_DIR;
  const developerDir = !selected || selected.endsWith("/CommandLineTools") ? "/Applications/Xcode.app/Contents/Developer" : selected;
  return { ...env, DEVELOPER_DIR: developerDir };
}

export function supportedXcode(output: string): boolean {
  const match = /Xcode (\d+)\.(\d+)/.exec(output);
  return !!match && (+match[1] > 26 || (+match[1] === 26 && +match[2] >= 4));
}

export function preflight(): void {
  const env = buildEnvironment();
  const xcode = run("xcodebuild", ["-version"], env);
  if (!supportedXcode(xcode)) throw new Error(`Local build needs Xcode 26.4+; installed: ${xcode.replace(/\n/g, ", ")}. No cloud build was started.`);
  for (const command of ["pnpm", "fastlane", "pod"]) run(command, ["--version"], env);
  // A version check can pass after an Xcode update while actool still lacks a usable iOS runtime.
  const require = createRequire(import.meta.url);
  const client = require.resolve("expo-dev-client/package.json");
  const menu = require.resolve("expo-dev-menu/package.json", { paths: [path.dirname(client)] });
  const assets = path.join(path.dirname(menu), "ios/Assets.xcassets");
  fs.accessSync(assets);
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "tracking-iphone-assets-"));
  try {
    run("xcrun", ["actool", assets, "--compile", output, "--platform", "iphoneos", "--minimum-deployment-target", "17.0", "--target-device", "iphone", "--target-device", "ipad"], env);
    if (!fs.existsSync(path.join(output, "Assets.car"))) throw new Error("Missing compiled asset catalog");
  } catch {
    throw new Error("Xcode cannot compile iPhone assets. Run xcodebuild -downloadPlatform iOS with the selected Xcode, then restart stale ibtoold/compiler services after installation. No EAS build was started.");
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
  console.log("Local iPhone toolchain and production public environment are ready. EAS login/signing and network access are also required.");
}

export function distribution(): Distribution {
  const expiresIn = Number(process.env.IPHONE_LINK_TTL ?? 604800);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 604800) throw new Error("IPHONE_LINK_TTL must be 60–604800 seconds.");
  const bucket = process.env.IPHONE_BUCKET ?? "alramalho-native-builds-854257060653";
  const region = process.env.IPHONE_REGION ?? "eu-central-1";
  if (!/^[a-z0-9][a-z0-9.-]+$/.test(bucket) || !/^[a-z0-9-]+$/.test(region)) throw new Error("Invalid S3 bucket/region.");
  return { bucket, region, expiresIn, prefix: "tracking-so/ios" };
}

export function storageEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, AWS_PAGER: "" };
  const file = process.env.IPHONE_STORAGE_ENV_FILE;
  if (file) {
    const values = parse(fs.readFileSync(file));
    env.AWS_ACCESS_KEY_ID = values.CUSTOM_AWS_ACCESS_KEY_ID ?? values.AWS_ACCESS_KEY_ID;
    env.AWS_SECRET_ACCESS_KEY = values.CUSTOM_AWS_SECRET_ACCESS_KEY ?? values.AWS_SECRET_ACCESS_KEY;
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) throw new Error("Storage env file has no AWS key pair.");
    delete env.AWS_SESSION_TOKEN;
    if (values.AWS_SESSION_TOKEN) env.AWS_SESSION_TOKEN = values.AWS_SESSION_TOKEN;
  }
  return env;
}
