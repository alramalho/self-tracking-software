export function notificationRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let path = value;
  if (value.startsWith("https://app.tracking.so/")) { const url = new URL(value); path = url.pathname + url.search; }
  if (value.startsWith("trackingso://")) path = "/" + value.slice("trackingso://".length);
  if (/^\/(session\/[^/?#]+|\(tabs\)\/plans|chat\/[^/?#]+|health|messages|notifications|plans|profile\/[^/?#]+)(\?[^#]*)?$/.test(path)) return path === "/plans" ? "/(tabs)/plans" : path;
  return null;
}
