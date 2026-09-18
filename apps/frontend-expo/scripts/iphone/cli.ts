import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appRoot, releaseRoot, buildEnvironment, preflight } from "./configuration";
import { verifyArtifact } from "./artifact";
import { manifest, installer, publish } from "./distribution";

async function main() {
  const action = process.argv[2] ?? "release";
  if (action === "check") return preflight();
  if (!["release", "build", "package", "publish"].includes(action)) throw new Error("Use check, release, build, package IPA, or publish IPA.");
  let ipa = process.argv[3] ? path.resolve(process.argv[3]) : "";
  const output = path.join(releaseRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`);
  if (action === "release" || action === "build") {
    preflight();
    fs.mkdirSync(output, { recursive: true, mode: 0o700 });
    ipa = path.join(output, "tracking.so.ipa");
    const result = spawnSync("pnpm", ["dlx", "eas-cli@24.0.0", "build", "--platform", "ios", "--profile", "device-production", "--local", "--non-interactive", "--output", ipa], { cwd: appRoot, env: buildEnvironment(), stdio: "inherit" });
    if (result.status !== 0) throw new Error("Local iPhone build failed. There is no automatic cloud fallback.");
  }
  if (!ipa) throw new Error("Supply an explicit IPA path; never implicitly publish a previous build.");
  const artifact = verifyArtifact(ipa);
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(output, "verified.json"), JSON.stringify(artifact, null, 2), { mode: 0o600 });
  if (action === "package") {
    // Offline preview only. These deliberately invalid hosts cannot install anything.
    fs.writeFileSync(path.join(output, "manifest.plist"), manifest(artifact, "https://preview.invalid/app.ipa"));
    fs.writeFileSync(path.join(output, "index.html"), installer(artifact, "https://preview.invalid/manifest.plist", "offline preview only"));
    console.log(`Verified build ${artifact.buildNumber}; OFFLINE installer preview: ${output}/index.html\nNo files uploaded and no install link created.`);
  } else if (action === "build") {
    console.log(`Verified local build ${artifact.buildNumber}: ${ipa}\nNot uploaded. Use build:iphone:publish with this IPA path.`);
  } else {
    console.log(`Verified build ${artifact.buildNumber}. Uploading installer…`);
    console.log(`Install link for build ${artifact.buildNumber}:\n${await publish(artifact, output)}`);
  }
}

main().catch(error => {
  // Do not dump subprocess arguments/environment: signed URLs and credentials are private.
  console.error(error instanceof Error ? error.message.split("\n")[0] : "iPhone release failed");
  process.exitCode = 1;
});
