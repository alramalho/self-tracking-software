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

// The backend's `{ error }` message on a failed request, so people read
// "This circle is full" instead of "Request failed with status code 400".
export function toApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please retry."
): string {
  const response = (error as Record<string, unknown> | null)?.response as
    | Record<string, unknown>
    | undefined;
  const data = response?.data as Record<string, unknown> | undefined;
  return typeof data?.error === "string" && data.error.trim()
    ? data.error
    : fallback;
}
