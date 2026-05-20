// eslint-disable-next-line @typescript-eslint/no-require-imports
const tzlookup = require("tz-lookup");

export function timezoneFromCoords(
  latitude: number,
  longitude: number
): string | null {
  try {
    return tzlookup(latitude, longitude) as string;
  } catch {
    return null;
  }
}
