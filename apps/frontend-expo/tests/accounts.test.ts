import test from "node:test";
import assert from "node:assert/strict";
import { forget, listAccounts, remember, toAccount } from "../src/auth/accounts";
import type { RememberedAccount, UserLike } from "../src/auth/types";

const user = (id: string, parts: Partial<UserLike> = {}): UserLike => ({
  id,
  fullName: null,
  username: null,
  imageUrl: "",
  primaryEmailAddress: null,
  ...parts,
});
const remembered = (id: string): RememberedAccount => ({
  ...toAccount(user(id, { fullName: id })),
  switchToken: `token-${id}`,
});

test("a Clerk user becomes an account row", () => {
  assert.deepEqual(
    toAccount(user("a", { fullName: "Alex", imageUrl: "https://img/alex.png", primaryEmailAddress: { emailAddress: "alex@x.so" } })),
    { userId: "a", name: "Alex", email: "alex@x.so", imageUrl: "https://img/alex.png" },
  );
});

test("account names fall back to username, email, then a generic label", () => {
  assert.equal(toAccount(user("a", { username: "axel" })).name, "axel");
  assert.equal(toAccount(user("b", { primaryEmailAddress: { emailAddress: "b@x.so" } })).name, "b@x.so");
  assert.equal(toAccount(user("c")).name, "Account");
  assert.equal(toAccount(user("c")).imageUrl, null);
});

test("remembering an account puts it first without duplicating it", () => {
  const accounts = remember(remember([], remembered("a")), remembered("b"));
  assert.deepEqual(accounts.map((account) => account.userId), ["b", "a"]);

  const renamed = { ...remembered("a"), name: "Alex" };
  assert.deepEqual(remember(accounts, renamed), [renamed, remembered("b")]);
});

test("logging out forgets only that account, and the next one takes over", () => {
  const accounts = [remembered("a"), remembered("b"), remembered("c")];
  assert.deepEqual(forget(accounts, "a").map((account) => account.userId), ["b", "c"]);
  assert.deepEqual(forget(accounts.slice(0, 1), "a"), []);
});

test("the switcher lists the active account first and never exposes switch tokens", () => {
  const active = toAccount(user("b", { fullName: "b" }));
  const listed = listAccounts(active, [remembered("a"), remembered("b")]);
  assert.deepEqual(listed.map((account) => account.userId), ["b", "a"]);
  assert.ok(listed.every((account) => !("switchToken" in account)));
});

test("signed out, the accounts to return to are the remembered ones", () => {
  assert.deepEqual(listAccounts(null, [remembered("a")]).map((account) => account.userId), ["a"]);
  assert.deepEqual(listAccounts(toAccount(user("a")), []).map((account) => account.userId), ["a"]);
});
