export interface WatchAuthClaims {
  sub: string;
  tokenUse: "access" | "refresh";
}

export interface WatchAuthTokens {
  accessToken: string;
  refreshToken: string;
}
