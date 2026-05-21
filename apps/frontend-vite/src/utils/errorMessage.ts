export function toDisplayErrorMessage(
  value: unknown,
  fallback = "Something went wrong"
): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value instanceof Error && value.message.trim()) {
    return value.message;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const message = record.message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}
