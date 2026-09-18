import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { manifest, installer, publish } from "../scripts/iphone/distribution";
import { publicEnvironment, supportedXcode } from "../scripts/iphone/configuration";
import type { Artifact, Command } from "../scripts/iphone/types";

const artifact: Artifact = { ipa: "/tmp/example.ipa", sha256: "fixture", bundleIdentifier: "so.tracking.app", version: "1.0.0", buildNumber: "9", profileExpiresAt: "2027-01-01", verifiedAt: "2026-09-13" };

test("installation manifest preserves signed URL queries and build identity", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iphone-manifest-test-"));
  try {
    const file = path.join(directory, "manifest.plist");
    const url = "https://example.com/app.ipa?X-Amz-Signature=abc&X-Amz-Credential=a%2Fb";
    fs.writeFileSync(file, manifest(artifact, url));
    const parsed = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }));
    assert.equal(parsed.items[0].assets[0].url, url);
    assert.equal(parsed.items[0].metadata["bundle-version"], "9");
    assert.equal(parsed.items[0].metadata["bundle-identifier"], "so.tracking.app");
    assert.ok(installer(artifact, url, "later").includes(encodeURIComponent(url)));
    assert.throws(() => manifest(artifact, "http://example.com/app.ipa"), /HTTPS/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("production config rejects test auth and localhost instead of falling back to Vite", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iphone-env-test-"));
  const file = path.join(directory, "environment.json");
  try {
    fs.writeFileSync(file, JSON.stringify({ EXPO_PUBLIC_BACKEND_URL: "http://localhost:3000", EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_test" }));
    assert.throws(() => publicEnvironment(file), /production/);
    fs.writeFileSync(file, JSON.stringify({ EXPO_PUBLIC_BACKEND_URL: "https://api.tracking.so", EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example", SECRET: "must not enter app" }));
    assert.equal(Object.keys(publicEnvironment(file)).length, 2);
    assert.equal(supportedXcode("Xcode 26.3\nBuild version 17C529"), false);
    assert.equal(supportedXcode("Xcode 26.4\nBuild version 17E"), true);
    assert.equal(supportedXcode("Xcode 27.0"), true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("publishing orders uploads before installer and verifies all signed downloads", async context => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iphone-publish-test-"));
  const calls: string[][] = [];
  const command: Command = (_command, args) => {
    calls.push(args);
    if (args[0] === "s3api") return JSON.stringify({ PublicAccessBlockConfiguration: { IgnorePublicAcls: true, RestrictPublicBuckets: true } });
    if (args[1] === "presign") return `https://example.com/${args[2].split("/").at(-1)}?signature=example`;
    return "";
  };
  const downloads: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string) => {
    downloads.push(url);
    return new Response("fixture");
  });
  try {
    const url = await publish(artifact, directory, command);
    assert.match(url, /index.html/);
    assert.deepEqual(calls.filter(args => args[1] === "cp").map(args => args[3].split("/").at(-1)), ["app.ipa", "manifest.plist", "index.html"]);
    assert.equal(downloads.length, 3);
    assert.ok(calls.every(args => !args.includes("--acl")));
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "distribution.json"), "utf8")).buildNumber, "9");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("upload failure cannot return an installation link", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iphone-failure-test-"));
  try {
    await assert.rejects(publish(artifact, directory, () => { throw new Error("upload failed"); }), /upload failed/);
    assert.equal(fs.existsSync(path.join(directory, "distribution.json")), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("public storage is rejected before any build is uploaded", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iphone-public-test-"));
  let calls = 0;
  try {
    await assert.rejects(publish(artifact, directory, () => {
      calls++;
      return JSON.stringify({ PublicAccessBlockConfiguration: { IgnorePublicAcls: true, RestrictPublicBuckets: false } });
    }), /private bucket/);
    assert.equal(calls, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
