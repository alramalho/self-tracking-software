import type { RememberedAccount } from "./types";

// A browser has no secure place for switch tokens, so web keeps one account at a time.
export async function loadRememberedAccounts(): Promise<RememberedAccount[]> {
  return [];
}

export async function saveRememberedAccounts(_accounts: RememberedAccount[]) {}
