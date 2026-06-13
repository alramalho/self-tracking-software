import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "so.tracking.app",
  appName: "tracking.so",
  webDir: "dist",
  backgroundColor: "#1c1c1c",
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
