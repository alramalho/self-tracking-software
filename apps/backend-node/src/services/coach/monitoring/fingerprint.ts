import { createHash } from "node:crypto";

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, ordered(entry)]),
    );
  return value;
}
/** PostgreSQL JSONB reorders keys; persistence alone must not invalidate a response. */
export function fingerprintValue(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(ordered(JSON.parse(JSON.stringify(value)))))
    .digest("hex");
}
