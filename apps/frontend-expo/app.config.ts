import type { ExpoConfig } from "expo/config";
import { config } from "dotenv";
import path from "node:path";

// Only public frontend values cross into the app bundle. Shell/EAS values win.
const legacy =
  config({
    path: path.resolve(__dirname, "../frontend-vite/.env"),
    quiet: true,
  }).parsed ?? {};
const publicValue = (name: string) =>
  process.env[`EXPO_PUBLIC_${name}`] ??
  process.env[`VITE_${name}`] ??
  legacy[`VITE_${name}`];
const backendUrl = publicValue("BACKEND_URL") || "http://localhost:3000";
const fixtureMode = process.env.EXPO_PUBLIC_E2E === "true";
if (
  fixtureMode &&
  (!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(backendUrl) ||
    process.env.EAS_BUILD === "true" ||
    process.env.NODE_ENV === "production")
) {
  throw new Error(
    "E2E authentication is restricted to local development with a loopback test server.",
  );
}
const projectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
  "45c5e480-d33f-4c91-b692-520122979596";
// What the app collects, all linked to the account, none used for tracking.
const functionality = "NSPrivacyCollectedDataTypePurposeAppFunctionality";
const personalization = "NSPrivacyCollectedDataTypePurposeProductPersonalization";
const analytics = "NSPrivacyCollectedDataTypePurposeAnalytics";
const collectedDataTypes = (
  [
    ["Name", [functionality, personalization]],
    ["EmailAddress", [functionality]],
    ["Health", [functionality, personalization]],
    ["Fitness", [functionality, personalization]],
    ["PreciseLocation", [functionality]],
    ["CoarseLocation", [functionality]],
    ["EmailsOrTextMessages", [functionality, personalization]],
    ["PhotosorVideos", [functionality, personalization]],
    ["AudioData", [functionality]],
    ["CustomerSupport", [functionality]],
    ["OtherUserContent", [functionality, personalization]],
    ["UserID", [functionality]],
    ["DeviceID", [functionality]],
    ["PurchaseHistory", [functionality]],
    ["ProductInteraction", [functionality, analytics]],
    ["OtherDiagnosticData", [functionality]],
    ["OtherDataTypes", [functionality, personalization]],
  ] as const
).map(([type, purposes]) => ({
  NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
  NSPrivacyCollectedDataTypeLinked: true,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: [...purposes],
}));
const app: ExpoConfig = {
  name: "tracking.so",
  icon: "./assets/icon.png",
  slug: "tracking-so",
  owner: "alramalho",
  scheme: "trackingso",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "so.tracking.app",
    // iPhone only for the App Store launch (no iPad layout review or iPad screenshots).
    supportsTablet: false,
    usesAppleSignIn: true,
    // Only what the app uses. The App Group stays on the App ID (EXPO_NO_CAPABILITY_SYNC
    // in scripts/iphone) but nothing reads it, so the app no longer claims it.
    entitlements: {
      "com.apple.developer.healthkit": true,
      "com.apple.developer.healthkit.background-delivery": true,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSHealthShareUsageDescription:
        "tracking.so reads your workouts with their routes, distance, heart rate and effort, and your sleep, to log your activities for you and show your trends.",
      // tracking.so only reads (toShare is empty), so iOS never shows this; the
      // HealthKit entitlement still requires the key.
      NSHealthUpdateUsageDescription:
        "Apple Health stays read-only for tracking.so: it reads the workouts and sleep you allow.",
      // Log locations only set the time zone and suggest friends who trained nearby,
      // and circles round to the city, so iOS offers approximate location by default.
      NSLocationDefaultAccuracyReduced: true,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      // Must match App Store Connect's App Privacy answers (and the privacy policy).
      NSPrivacyCollectedDataTypes: collectedDataTypes,
      // Includes the reasons of SDKs whose own manifests the prebuilt frameworks drop.
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
      ],
    },
  },
  android: { package: "so.tracking.app" },
  web: { bundler: "metro", output: "single", name: "tracking.so" },
  plugins: [
    "./plugins/with-watch.cjs",
    "./plugins/with-release-privacy.cjs",
    ["expo-build-properties", { ios: { deploymentTarget: "17.0" } }],
    "expo-apple-authentication",
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-light.png",
        imageWidth: 96,
        resizeMode: "contain",
        backgroundColor: "#f2f2f2",
        dark: { image: "./assets/splash-dark.png", backgroundColor: "#1c1c1c" },
      },
    ],
    ["@clerk/expo", { theme: "./src/auth/native-theme.json" }],
    // No biometric unlock: drop the plugin's generic Face ID purpose string.
    ["expo-secure-store", { faceIDPermission: false }],
    [
      "expo-audio",
      {
        microphonePermission:
          "Record a voice note or dictate an answer. The recording is sent to our speech-to-text provider to turn it into text.",
        // Recording happens only on screen and nothing plays in the background,
        // so no background audio mode (App Review checks UIBackgroundModes).
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
      },
    ],
    [
      "expo-image-picker",
      {
        // The photo picker needs no library access; the key stays because the
        // library's code references it (ITMS-90683).
        photosPermission: "Choose photos to add to your activity logs and messages.",
        cameraPermission: "Take a photo for an activity log or a message.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Add where you trained to an activity log, which sets its time zone and suggests friends who trained with you, and find circles near you. Only while you use the app.",
        // The app never asks for Always location; `false` keeps the plugin's generic
        // descriptions out of Info.plist. Motion stays: the library's code references
        // the motion API, and Apple rejects uploads without a purpose string (ITMS-90683).
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission:
          "Motion data isn't part of tracking.so; the location tools it uses include motion support.",
      },
    ],
    [
      "expo-calendar",
      {
        calendarPermission:
          "Reads only the calendar you pick, to find and update the sessions tracking.so added there. Nothing from your calendar leaves your phone.",
        remindersPermission: false,
      },
    ],
    "expo-notifications",
    "expo-web-browser",
    // StoreKit 2 in-app subscriptions (coaching on iOS).
    "expo-iap",
  ],
  experiments: { typedRoutes: true },
  extra: {
    backendUrl,
    clerkPublishableKey: publicValue("CLERK_PUBLISHABLE_KEY"),
    fixtureMode,
    ...(projectId ? { eas: { projectId } } : {}),
  },
};
export default app;
