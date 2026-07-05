export function parseExtraCorsOrigins(
  value = process.env.EXTRA_CORS_ORIGINS
): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function withExtraCorsOrigins(origins: string[]): string[] {
  return Array.from(new Set([...origins, ...parseExtraCorsOrigins()]));
}
