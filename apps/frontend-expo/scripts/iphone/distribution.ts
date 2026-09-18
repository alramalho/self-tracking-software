import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { distribution, run, storageEnvironment } from "./configuration";
import type { Artifact, Command } from "./types";

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
function https(url: string): string {
  if (new URL(url).protocol !== "https:") throw new Error("iPhone installation requires HTTPS links.");
  return url;
}

export function manifest(artifact: Artifact, ipaUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>items</key><array><dict>
<key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>${escape(https(ipaUrl))}</string></dict></array>
<key>metadata</key><dict><key>bundle-identifier</key><string>${escape(artifact.bundleIdentifier)}</string><key>bundle-version</key><string>${escape(artifact.buildNumber)}</string><key>kind</key><string>software</string><key>title</key><string>tracking.so</string></dict>
</dict></array></dict></plist>`;
}

export function installer(artifact: Artifact, manifestUrl: string, expiresAt: string): string {
  const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(https(manifestUrl))}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Install tracking.so</title>
<style>:root{color-scheme:light dark;font-family:system-ui,-apple-system,sans-serif}body{margin:0;padding:32px 24px;min-height:85vh;display:grid;place-items:center;background:light-dark(#f2f2f2,#1c1c1c);color:light-dark(#171717,#fafafa)}main{max-width:360px;width:100%;text-align:center}.logo{font-size:64px;font-weight:800;color:#eab308}h1{font-size:28px}p{line-height:1.6;color:light-dark(#555,#aaa)}a{display:block;border-radius:20px;padding:18px;background:#eab308;color:#171717;font-weight:700;text-decoration:none}small{display:block;margin-top:24px;line-height:1.5}</style></head>
<body><main><div class="logo">t</div><h1>tracking.so</h1><p>Version ${escape(artifact.version)} · Build ${escape(artifact.buildNumber)}<br>Connected to your production account.</p><a href="${escape(installUrl)}">Install on iPhone</a><p>Open this page in Safari, tap Install, then return to your Home Screen.</p>${artifact.watch ? "<p><strong>Apple Watch included.</strong><br>Sign in on your iPhone, then open the Watch app → My Watch → Available Apps → tracking.so → Install.</p>" : ""}<small>For registered test devices.<br>Download link expires ${escape(expiresAt)}.</small></main></body></html>`;
}

export async function publish(artifact: Artifact, output: string, command: Command = run): Promise<string> {
  const config = distribution();
  const env = storageEnvironment();
  const access = JSON.parse(command("aws", ["s3api", "get-public-access-block", "--bucket", config.bucket, "--region", config.region], env)).PublicAccessBlockConfiguration;
  if (!access?.IgnorePublicAcls || !access?.RestrictPublicBuckets) {
    throw new Error("Installer storage must block public ACLs and public bucket policies. Select an existing private bucket with IPHONE_BUCKET; do not alter production media permissions.");
  }
  const prefix = `${config.prefix}/${artifact.buildNumber}-${randomUUID()}`;
  const s3 = (file: string) => `s3://${config.bucket}/${prefix}/${file}`;
  const signed = (file: string) => command("aws", ["s3", "presign", s3(file), "--region", config.region, "--expires-in", String(config.expiresIn)], env);
  const upload = (file: string, name: string, type: string) => command("aws", ["s3", "cp", file, s3(name), "--region", config.region, "--content-type", type, "--content-disposition", "inline", "--cache-control", "private, no-store", "--only-show-errors"], env);
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  // IPA and manifest must exist before exposing the installer. Never change bucket policies/ACLs.
  upload(artifact.ipa, "app.ipa", "application/octet-stream");
  const ipaUrl = signed("app.ipa");
  fs.writeFileSync(path.join(output, "manifest.plist"), manifest(artifact, ipaUrl), { mode: 0o600 });
  upload(path.join(output, "manifest.plist"), "manifest.plist", "text/xml");
  const manifestUrl = signed("manifest.plist");
  const expiresAt = new Date(Date.now() + config.expiresIn * 1000).toISOString();
  fs.writeFileSync(path.join(output, "index.html"), installer(artifact, manifestUrl, expiresAt), { mode: 0o600 });
  upload(path.join(output, "index.html"), "index.html", "text/html; charset=utf-8");
  const url = signed("index.html");
  fs.writeFileSync(path.join(output, "distribution.json"), JSON.stringify({ ...artifact, bucket: config.bucket, prefix, expiresAt, installUrl: url }, null, 2), { mode: 0o600 });
  // Fetch the exact presigned GET links (HEAD is not interchangeable with signed GET).
  for (const link of [ipaUrl, manifestUrl, url]) {
    const response = await fetch(link, { signal: AbortSignal.timeout(30000) });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Hosted download verification failed: HTTP ${response.status}. See local distribution.json.`);
  }
  return url;
}
