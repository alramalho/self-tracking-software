import * as SecureStore from "expo-secure-store";
import type { RememberedAccount } from "./types";

// Switch tokens sign an account in, so they live in the Keychain / Keystore.
const key = "trackingso.remembered-accounts";

export async function loadRememberedAccounts(): Promise<RememberedAccount[]> {
  try {
    return JSON.parse((await SecureStore.getItemAsync(key)) ?? "[]");
  } catch {
    return [];
  }
}

export async function saveRememberedAccounts(accounts: RememberedAccount[]) {
  await SecureStore.setItemAsync(key, JSON.stringify(accounts));
}
