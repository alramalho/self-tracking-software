const INVALID_DEVICE_TOKEN_REASONS = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "Unregistered",
]);

export function isInvalidApnsDeviceToken(
  reason: string,
  status?: number,
): boolean {
  return status === 410 || INVALID_DEVICE_TOKEN_REASONS.has(reason);
}
