import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "so.tracking.app",
  appName: "tracking.so",
  webDir: "dist",
  server: {
    allowNavigation: [
      "clerk.accounts.dev",
      "*.clerk.accounts.dev",
      "fonts.googleapis.com",
      "fonts.gstatic.com"
    ],
    cleartext: true
  },
  ios: {
    contentInset: "automatic"
  }
};

export default config;
