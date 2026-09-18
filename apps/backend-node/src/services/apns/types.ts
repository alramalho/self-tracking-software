export interface ApnsPushPayload {
  deviceToken: string;
  title: string;
  body: string;
  badge?: number;
  sound?: string;
  data?: Record<string, unknown>;
}

export class ApnsDeliveryError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
    public readonly status?: number,
    public readonly invalidDeviceToken = false,
  ) {
    super(message);
    this.name = "ApnsDeliveryError";
  }
}
