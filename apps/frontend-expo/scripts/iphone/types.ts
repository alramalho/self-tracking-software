export type PublicEnvironment = {
  EXPO_PUBLIC_BACKEND_URL: string;
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
};

export type Artifact = {
  ipa: string;
  sha256: string;
  bundleIdentifier: string;
  version: string;
  buildNumber: string;
  profileExpiresAt: string;
  verifiedAt: string;
  watch?: {
    bundleIdentifier: string;
    buildNumber: string;
    profileExpiresAt: string;
  };
};

export type Distribution = {
  bucket: string;
  region: string;
  expiresIn: number;
  prefix: string;
};

export type Command = (command: string, args: string[], env?: NodeJS.ProcessEnv) => string;
