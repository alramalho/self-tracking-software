// A circle invite opened before signing in or finishing onboarding. Kept across the
// sign-in redirect and onboarding, then reopened once the app is usable.
const PENDING_INVITE_KEY = "pending-circle-invite";
const INVITE_PATH = /^\/circle-invite\/([^/?#]+)/;

export function inviteCodeFromPath(pathname: string): string | null {
  return INVITE_PATH.exec(pathname)?.[1] ?? null;
}

// Called before redirecting away from `pathname`: keeps its invite code, if it is an invite page.
export function rememberCircleInviteAt(pathname: string) {
  const code = inviteCodeFromPath(pathname);
  if (!code) return;
  try {
    localStorage.setItem(PENDING_INVITE_KEY, code);
  } catch {
    // Storage off (private mode): the invite link simply has to be opened again.
  }
}

export function pendingCircleInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function forgetCircleInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Nothing stored to forget.
  }
}
