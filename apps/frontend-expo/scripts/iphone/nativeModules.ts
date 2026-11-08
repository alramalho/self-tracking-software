import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appRoot, run } from "./configuration";

// Our own Expo modules live in modules/<name>/ios. If a build's source copy drops
// those folders (an unanchored `ios/` ignore rule did this for builds 231, 244 and
// 245), the app still compiles, then crashes at launch on requireNativeModule.
function localModuleClasses(): string[] {
  const modulesRoot = path.join(appRoot, "modules");
  if (!fs.existsSync(modulesRoot)) return [];
  return fs.readdirSync(modulesRoot)
    .filter(name => fs.existsSync(path.join(modulesRoot, name, "ios")))
    .flatMap(name => {
      const config = JSON.parse(fs.readFileSync(path.join(modulesRoot, name, "expo-module.config.json"), "utf8"));
      return (config.apple?.modules ?? config.ios?.modules ?? []) as string[];
    });
}

export function assertNativeModulesLinked(app: string, executable: string): void {
  const binary = fs.readFileSync(path.join(app, executable));
  const missing = localModuleClasses().filter(moduleClass => !binary.includes(moduleClass));
  assert.deepEqual(missing, [], `Native modules missing from the app binary: ${missing.join(", ")}`);
}

export function assertIpaNativeModulesLinked(ipa: string): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tracking-iphone-modules-"));
  try {
    run("ditto", ["-x", "-k", ipa, directory]);
    const payload = path.join(directory, "Payload");
    const app = path.join(payload, fs.readdirSync(payload).find(name => name.endsWith(".app")) ?? "");
    const info = JSON.parse(run("plutil", ["-convert", "json", "-o", "-", path.join(app, "Info.plist")]));
    assertNativeModulesLinked(app, info.CFBundleExecutable);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
