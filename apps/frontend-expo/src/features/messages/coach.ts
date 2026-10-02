import { coachAvatar } from "@/features/coach/avatar";

// `avatar` is the clay figure bundled with the app: pass it straight to an Image's `source`.
export function coachIdentity(personality?: string) {
  return personality === "STRATEGIST"
    ? { name: "Oli", title: "The Strategist", avatar: coachAvatar(true) }
    : { name: "Helly", title: "The Champion", avatar: coachAvatar(false) };
}
