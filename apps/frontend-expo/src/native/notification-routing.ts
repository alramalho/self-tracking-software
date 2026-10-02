export function notificationRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let path = value;
  if (value.startsWith("https://app.tracking.so/")) {
    const url = new URL(value);
    path = url.pathname + url.search;
  }
  if (value.startsWith("trackingso://"))
    path = "/" + value.slice("trackingso://".length);
  if (path.startsWith("/?")) {
    const url = new URL(path, "https://app.tracking.so");
    const keys = [...url.searchParams.keys()];
    if (
      keys.length !== 1 ||
      !["activityEntryId", "achievementPostId"].includes(keys[0])
    )
      return null;
    const id = url.searchParams.get(keys[0]);
    return id && id.length <= 200 ? `/?${keys[0]}=${encodeURIComponent(id)}` : null;
  }
  if (
    /^\/(session\/[^/?#]+|\(tabs\)\/plans|chat\/[^/?#]+|plan\/[^/?#]+|health|messages|notifications|plans|profile\/[^/?#]+)(\?[^#]*)?$/.test(
      path,
    )
  )
    return path === "/plans" ? "/(tabs)/plans" : path;
  return null;
}
