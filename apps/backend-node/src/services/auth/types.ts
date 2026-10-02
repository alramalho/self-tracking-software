export interface WatchAuthClaims {
  sub: string;
  tokenUse: "access" | "refresh";
}

export interface WatchAuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** The stored half of an account switch token; the plaintext lives only on the device. */
export interface StoredSwitchToken {
  id: string;
  userId: string;
  tokenHash: string;
  lastUsedAt: Date;
}
