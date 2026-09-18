export interface WatchBridge {
  setAccount(account: string | null): Promise<void>;
  sendTokens(account: string, access: string, refresh: string): Promise<void>;
}
export interface WatchTokens {
  accessToken: string;
  refreshToken: string;
}
