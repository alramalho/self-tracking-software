export interface NativeAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface WatchAuthPlugin {
  sendTokens(options: NativeAuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface AuthContextType {
  userId: string | null;
  isLoading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}
