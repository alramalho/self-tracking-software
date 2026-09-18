import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { publicEnvironment, releaseRoot, run } from "./configuration";
import type { Artifact } from "./types";

export function verifyArtifact(ipa: string): Artifact {
  const expected = publicEnvironment();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tracking-iphone-verify-"));
  try {
    run("ditto", ["-x", "-k", ipa, directory]);
    const payload = path.join(directory, "Payload");
    const apps = fs.readdirSync(payload).filter(name => name.endsWith(".app"));
    assert.equal(apps.length, 1, "Expected one iPhone app");
    const app = path.join(payload, apps[0]);
    const plist = (file: string) => JSON.parse(run("plutil", ["-convert", "json", "-o", "-", file]));
    const info = plist(path.join(app, "Info.plist"));
    const config = JSON.parse(fs.readFileSync(path.join(app, "EXConstants.bundle/app.config"), "utf8"));
    assert.equal(info.CFBundleIdentifier, "so.tracking.app");
    assert.equal(info.DTPlatformName, "iphoneos", "Simulator apps cannot be installed on iPhone");
    assert.equal(config.extra.backendUrl, expected.EXPO_PUBLIC_BACKEND_URL);
    assert.equal(config.extra.clerkPublishableKey, expected.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
    assert.equal(config.extra.fixtureMode, false);
    assert.ok(fs.statSync(path.join(app, "main.jsbundle")).size > 0, "Release must contain bundled JS");
    const profileFile = path.join(directory, "profile.plist");
    // Verify the embedded CMS signature without importing certificates into Keychain.
    // iOS performs Apple's provisioning trust-chain validation at installation time.
    run("openssl", ["cms", "-verify", "-inform", "DER", "-noverify", "-in", path.join(app, "embedded.mobileprovision"), "-out", profileFile]);
    fs.chmodSync(profileFile, 0o600);
    // plutil cannot serialize the Date/Data entries of provisioning profiles to JSON.
    const profile = JSON.parse(run("python3", ["-c", "import plistlib,json,sys,datetime; p=plistlib.load(open(sys.argv[1],'rb')); print(json.dumps(p,default=lambda x: x.replace(tzinfo=datetime.timezone.utc).isoformat() if isinstance(x,datetime.datetime) else None))", profileFile]));
    assert.ok(profile.ProvisionedDevices?.includes("00008140-000148693CC0801C"), "Registered iPhone must be provisioned");
    assert.ok(new Date(profile.ExpirationDate).getTime() > Date.now(), "Provisioning profile expired");
    assert.equal(profile.Entitlements["application-identifier"], "7P4CMS849D.so.tracking.app");
    assert.equal(profile.Entitlements["get-task-allow"], false, "Expected a release distribution profile");
    run("codesign", ["--verify", "--deep", "--strict", app]);
    const entitlementsFile = path.join(directory, "entitlements.plist");
    fs.writeFileSync(entitlementsFile, run("codesign", ["-d", "--entitlements", ":-", app]));
    const entitlements = plist(entitlementsFile);
    assert.equal(entitlements["application-identifier"], "7P4CMS849D.so.tracking.app");
    assert.equal(entitlements["com.apple.developer.healthkit"], true);
    assert.ok(entitlements["com.apple.security.application-groups"]?.includes("group.so.tracking.app"));
    let watch: Artifact["watch"];
    const expectsWatch = config.extra?.eas?.build?.experimental?.ios?.appExtensions
      ?.some((target: { bundleIdentifier: string }) => target.bundleIdentifier === "so.tracking.app.watchkitapp");
    if (expectsWatch || fs.existsSync(path.join(app, "Watch"))) {
      const watches = fs.readdirSync(path.join(app, "Watch")).filter(name => name.endsWith(".app"));
      assert.equal(watches.length, 1, "Release must embed one Watch app");
      const watchApp = path.join(app, "Watch", watches[0]);
      const watchInfo = plist(path.join(watchApp, "Info.plist"));
      assert.equal(watchInfo.CFBundleIdentifier, "so.tracking.app.watchkitapp");
      assert.equal(watchInfo.WKCompanionAppBundleIdentifier, info.CFBundleIdentifier);
      assert.equal(watchInfo.CFBundleVersion, info.CFBundleVersion, "Watch/iPhone build numbers must match");
      assert.equal(watchInfo.CFBundleShortVersionString, info.CFBundleShortVersionString);
      assert.equal(watchInfo.DTPlatformName, "watchos", "Watch must be a physical-device binary");
      assert.equal(watchInfo.WKApplication, true);
      const watchProfileFile = path.join(directory, "watch-profile.plist");
      run("openssl", ["cms", "-verify", "-inform", "DER", "-noverify", "-in", path.join(watchApp, "embedded.mobileprovision"), "-out", watchProfileFile]);
      const watchProfile = JSON.parse(run("python3", ["-c", "import plistlib,json,sys,datetime; p=plistlib.load(open(sys.argv[1],'rb')); print(json.dumps(p,default=lambda x: x.replace(tzinfo=datetime.timezone.utc).isoformat() if isinstance(x,datetime.datetime) else None))", watchProfileFile]));
      const expectedDevice = JSON.parse(fs.readFileSync(process.env.IPHONE_WATCH_DEVICE_FILE ?? path.join(releaseRoot, "watch-device.json"), "utf8"));
      assert.equal(expectedDevice.deviceClass, "APPLE_WATCH", "Verify Watch identity against Apple device registration");
      assert.ok(watchProfile.ProvisionedDevices?.includes(expectedDevice.udid), "The registered Watch must be provisioned");
      assert.ok(new Date(watchProfile.ExpirationDate).getTime() > Date.now());
      assert.equal(watchProfile.Entitlements["application-identifier"], "7P4CMS849D.so.tracking.app.watchkitapp");
      assert.equal(watchProfile.Entitlements["get-task-allow"], false);
      run("codesign", ["--verify", "--strict", watchApp]);
      const watchEntitlementsFile = path.join(directory, "watch-entitlements.plist");
      fs.writeFileSync(watchEntitlementsFile, run("codesign", ["-d", "--entitlements", ":-", watchApp]));
      const watchEntitlements = plist(watchEntitlementsFile);
      assert.equal(watchEntitlements["application-identifier"], "7P4CMS849D.so.tracking.app.watchkitapp");
      assert.equal(watchEntitlements["get-task-allow"] ?? false, false);
      assert.ok(watchEntitlements["com.apple.developer.applesignin"]?.includes("Default"));
      assert.ok(watchEntitlements["com.apple.security.application-groups"]?.includes("group.so.tracking.app"));
      assert.ok(fs.statSync(path.join(watchApp, watchInfo.CFBundleExecutable)).size > 0);
      assert.ok(fs.statSync(path.join(watchApp, "Assets.car")).size > 0, "Watch icon asset catalog must be compiled");
      assert.ok(watchInfo.CFBundleIcons?.CFBundlePrimaryIcon?.CFBundleIconName, "Watch app icon metadata must be present");
      watch = { bundleIdentifier: watchInfo.CFBundleIdentifier, buildNumber: watchInfo.CFBundleVersion, profileExpiresAt: watchProfile.ExpirationDate };
    }
    return {
      ipa: path.resolve(ipa), sha256: createHash("sha256").update(fs.readFileSync(ipa)).digest("hex"),
      bundleIdentifier: info.CFBundleIdentifier, version: info.CFBundleShortVersionString,
      buildNumber: info.CFBundleVersion, profileExpiresAt: profile.ExpirationDate, verifiedAt: new Date().toISOString(),
      ...(watch ? { watch } : {}),
    };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
