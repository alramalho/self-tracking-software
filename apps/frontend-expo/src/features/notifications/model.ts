import type { AppNotification } from "@/features/social/types";
import type {
  NotificationActor,
  NotificationSections,
  NotificationText,
} from "./types";

// The backend names the person after their role: `reactorPicture`, `commenterName`, `userUsername`…
const ROLES = ["", "user", "reactor", "commenter", "sender", "linkedBy"];

export function isUnread(notification: AppNotification) {
  return notification.status !== "OPENED" && notification.status !== "CONCLUDED";
}

/** Dismissed notices and the old AI engagement prompts never show in the list. */
export function shownNotifications(notifications: AppNotification[]) {
  return notifications.filter(
    (n) => n.status !== "CONCLUDED" && n.type !== "ENGAGEMENT",
  );
}

export function notificationActor(
  notification: AppNotification,
): NotificationActor | null {
  const data = notification.relatedData ?? {};
  const text = (key: string) =>
    typeof data[key] === "string" && data[key] ? (data[key] as string) : undefined;
  for (const role of ROLES) {
    const field = (name: string) =>
      role ? role + name[0].toUpperCase() + name.slice(1) : name;
    const picture = text(field("picture"));
    const name = text(field("name")) ?? text(field("username"));
    if (picture || name) return { name: name ?? "", picture };
  }
  const coach = text("coachName");
  return coach ? { name: coach } : null;
}

export function notificationText(notification: AppNotification): NotificationText {
  const raw = (notification.message || notification.body || notification.title || "")
    .replace(/\*\*|__/g, "")
    .trim();
  const { text: line, emoji } = splitClosingEmoji(raw);
  // "reacted to your activity with 🚀": the emoji moves onto the avatar, so the dangling "with" goes too.
  const text = emoji ? line.replace(/\s+with$/i, "") : line;
  const handle = text.match(/^@[\w.]+/)?.[0];
  return { handle, rest: handle ? text.slice(handle.length) : text, emoji };
}

/** "now", "5m", "3h", "2d", "3w", then the date: short, like the rest of the app's cards. */
export function timeAgo(createdAt: string | undefined, now = new Date()) {
  if (!createdAt) return "";
  const then = new Date(createdAt);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (Number.isNaN(minutes)) return "";
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  const days = Math.floor(minutes / (60 * 24));
  if (days < 7) return `${days}d`;
  if (days < 35) return `${Math.floor(days / 7)}w`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = `${then.getDate()} ${months[then.getMonth()]}`;
  return then.getFullYear() === now.getFullYear() ? date : `${date} ${then.getFullYear()}`;
}

/** `freshIds` are the ones still unread when the screen opened, so they stay under New after being marked seen. */
export function splitSections<T extends { id: string }>(
  notifications: T[],
  freshIds: Set<string>,
): NotificationSections<T> {
  return {
    fresh: notifications.filter((n) => freshIds.has(n.id)),
    earlier: notifications.filter((n) => !freshIds.has(n.id)),
  };
}

// Emoji detection by code point: Hermes has no Intl.Segmenter, so this walks the characters itself.
const ZWJ = 0x200d;
const isModifier = (cp: number) => cp === 0xfe0f || (cp >= 0x1f3fb && cp <= 0x1f3ff);
const isPictograph = (cp: number) =>
  !isModifier(cp) &&
  ((cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2300 && cp <= 0x23ff) ||
    (cp >= 0x2b00 && cp <= 0x2bff));

/** "…reacted to your activity with 🚀" → the text and "🚀". Only the last emoji (with its joins) is taken. */
export function splitClosingEmoji(value: string): { text: string; emoji?: string } {
  const chars = Array.from(value.trimEnd());
  const cp = (i: number) => chars[i]?.codePointAt(0) ?? 0;
  let start = chars.length;
  const skipModifiers = () => {
    while (start > 0 && isModifier(cp(start - 1))) start--;
  };
  skipModifiers();
  if (start === 0 || !isPictograph(cp(start - 1))) return { text: value };
  start--;
  while (start > 1 && cp(start - 1) === ZWJ) {
    start--;
    skipModifiers();
    if (start === 0 || !isPictograph(cp(start - 1))) return { text: value };
    start--;
  }
  const text = chars.slice(0, start).join("").trimEnd();
  if (!text) return { text: value };
  return { text, emoji: chars.slice(start).join("") };
}
