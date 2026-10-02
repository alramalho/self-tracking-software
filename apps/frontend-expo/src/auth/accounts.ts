import type { Account, RememberedAccount, UserLike } from "./types";

export function toAccount(user: UserLike): Account {
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  return {
    userId: user.id,
    name: user.fullName || user.username || email || "Account",
    email,
    imageUrl: user.imageUrl || null,
  };
}

/** Puts the account first, so the list reads most recently used first. */
export function remember(accounts: RememberedAccount[], account: RememberedAccount) {
  return [account, ...forget(accounts, account.userId)];
}

export function forget(accounts: RememberedAccount[], userId: string | null) {
  return accounts.filter((account) => account.userId !== userId);
}

/** Account rows for the switcher: the active one first, and no switch tokens. */
export function listAccounts(active: Account | null, remembered: RememberedAccount[]): Account[] {
  const others = forget(remembered, active?.userId ?? null).map(
    ({ switchToken: _, ...account }) => account,
  );
  return active ? [active, ...others] : others;
}
