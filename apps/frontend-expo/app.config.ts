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
    supportsTablet: true,
    usesAppleSignIn: true,
    // Preserve capabilities on the bundle identifier shared with Capacitor.
    entitlements: {
      "com.apple.developer.healthkit": true,
      "com.apple.developer.healthkit.background-delivery": true,
      "com.apple.security.application-groups": ["group.so.tracking.app"],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSHealthShareUsageDescription:
        "Import workouts, effort and heart-rate summaries, and sleep from Apple Health to simplify activity logging and show your trends.",
      NSHealthUpdateUsageDescription:
        "Update your tracking.so activity record and keep the health trends you choose synchronized with Apple Health.",
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
      ],
    },
  },
  android: { package: "so.tracking.app" },
  web: { bundler: "metro", output: "single", name: "tracking.so" },
  plugins: [
    "./plugins/with-watch.cjs",
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
    "expo-secure-store",
    [
      "expo-audio",
      {
        microphonePermission:
          "Record your answer so tracking.so can turn it into text.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Add photos to your activity logs.",
        cameraPermission: "Take photos for your activity logs.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Record your activity location and route.",
        // The app never asks for Always location; `false` keeps the plugin's generic
        // descriptions out of Info.plist. Motion stays: the library's code references
        // the motion API, and Apple rejects uploads without a purpose string (ITMS-90683).
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: "Motion data can improve route recording while you log an activity.",
      },
    ],
    [
      "expo-calendar",
      {
        calendarPermission:
          "Sync the sessions you choose with your calendar. Only tracking.so events are updated.",
        remindersPermission: false,
      },
    ],
    "expo-notifications",
    "expo-web-browser",
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
