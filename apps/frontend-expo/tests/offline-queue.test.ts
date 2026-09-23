import assert from "node:assert/strict";
import test from "node:test";
import { OfflineLogQueue } from "../src/features/offline/queue";
import type { QueuedLog } from "../src/features/offline/types";
import type { LogActivityResult } from "../src/core/types";

const log = (id: string): QueuedLog => ({ id, activityId: "activity", activityTitle: "Run",
  datetime: "2026-09-22T12:34:00.000Z", timezone: "Europe/Lisbon", quantity: 2,
  description: "Caption", privateNotes: "Private", withUserId: "friend",
  latitude: 38.7, longitude: -9.1, photos: [], status: "pending" });
const result = (id: string): LogActivityResult => ({ entry: { id, userId: "one", activityId: "activity",
  datetime: "2026-09-22T12:34:00.000Z", createdAt: "2026-09-22T12:35:00.000Z", quantity: 2 },
  sharedActivityCandidates: [] });

function fixture(send: (entry: QueuedLog, checkpoint: (entryId: string) => Promise<void>) => Promise<LogActivityResult>) {
  let saved: QueuedLog[] = [];
  const create = () => new OfflineLogQueue({
    read: async () => saved,
    write: async (entries) => { saved = JSON.parse(JSON.stringify(entries)); },
    send,
    isPermanentError: (error) => error instanceof Error && error.message === "invalid",
    message: (error) => String(error),
    changed: () => {}, synced: () => {},
  });
  return { create, get saved() { return saved; } };
}

test("a disconnected log survives restart with its original fields and syncs once", async () => {
  let connected = false;
  const sent: QueuedLog[] = [];
  const store = fixture(async (entry) => {
    if (!connected) throw new Error("offline");
    sent.push(entry);
    return result(entry.id);
  });
  const first = store.create();
  assert.equal(await first.enqueue(log("request-1")), undefined);
  assert.equal(store.saved[0].description, "Caption");
  assert.equal(store.saved[0].timezone, "Europe/Lisbon");
  first.close();
  connected = true;
  const restarted = store.create();
  await restarted.sync();
  await restarted.sync();
  assert.deepEqual(sent.map((item) => item.id), ["request-1"]);
  assert.equal(sent[0].datetime, "2026-09-22T12:34:00.000Z");
  assert.equal(sent[0].privateNotes, "Private");
  assert.equal(sent[0].withUserId, "friend");
  assert.equal(sent[0].latitude, 38.7);
  assert.equal(store.saved.length, 0);
});

test("uncertain responses retain the same key and keep later logs ordered", async () => {
  const calls: string[] = [];
  const applied = new Set<string>();
  let loseResponse = true;
  const store = fixture(async (entry) => {
    calls.push(entry.id);
    applied.add(entry.id); // Simulate a committed server transaction.
    if (loseResponse) { loseResponse = false; throw new Error("response lost"); }
    return result(entry.id);
  });
  const queue = store.create();
  await queue.enqueue(log("first"));
  await queue.enqueue(log("second"));
  assert.deepEqual(calls, ["first", "first", "second"]);
  assert.deepEqual([...applied], ["first", "second"]);
  assert.equal(store.saved.length, 0);
});

test("validation errors keep the log until explicit retry", async () => {
  let valid = false;
  let requests = 0;
  const store = fixture(async (entry) => {
    requests++;
    if (!valid) throw new Error("invalid");
    return result(entry.id);
  });
  const queue = store.create();
  await queue.enqueue(log("request"));
  assert.equal(store.saved[0].status, "error");
  await queue.sync();
  assert.equal(requests, 1);
  valid = true;
  await queue.sync(true);
  assert.equal(store.saved.length, 0);
});

test("a photo upload failure resumes from its persisted entry checkpoint", async () => {
  let posts = 0;
  let uploads = 0;
  let connected = false;
  const store = fixture(async (entry, checkpoint) => {
    if (!entry.entryId) {
      posts++;
      await checkpoint("server-entry");
    }
    uploads++;
    if (!connected) throw new Error("photo upload offline");
    return result("server-entry");
  });
  const first = store.create();
  await first.enqueue({ ...log("photo-request"), photos: [{ uri: "file:///saved.jpg", name: "saved.jpg", type: "image/jpeg" }] });
  assert.equal(store.saved[0].entryId, "server-entry");
  first.close();
  connected = true;
  await store.create().sync();
  assert.equal(posts, 1);
  assert.equal(uploads, 2);
  assert.equal(store.saved.length, 0);
});

test("a storage failure after enqueue retains staged photos and retries the same request", async () => {
  const photo = { uri: "file:///documents/photo.jpg", name: "photo.jpg", type: "image/jpeg" };
  let saved: QueuedLog[] = [];
  let failRemoval = true;
  const applied = new Set<string>();
  const queue = new OfflineLogQueue({
    read: async () => saved.map((item) => ({ ...item, status: "pending" })),
    write: async (logs) => {
      if (!logs.length && failRemoval) { failRemoval = false; throw new Error("disk full"); }
      saved = JSON.parse(JSON.stringify(logs));
    },
    send: async (item) => { applied.add(item.id); return result(item.id); },
    isPermanentError: () => false,
    message: String,
    changed: () => {}, synced: () => {},
  });
  assert.equal(await queue.enqueue({ ...log("saved-key"), photos: [photo] }), undefined);
  assert.equal(queue.snapshot[0].status, "pending");
  assert.equal(queue.snapshot[0].photos[0].uri, photo.uri);
  queue.close();
  const retry = new OfflineLogQueue({
    read: async () => saved.map((item) => ({ ...item, status: "pending" })),
    write: async (logs) => { saved = JSON.parse(JSON.stringify(logs)); },
    send: async (item) => { applied.add(item.id); return result(item.id); },
    isPermanentError: () => false, message: String, changed: () => {}, synced: () => {},
  });
  await retry.sync();
  assert.deepEqual([...applied], ["saved-key"]);
  assert.equal(saved.length, 0);
});

test("closing an account stops its remaining logs without touching another account", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const stores = new Map<string, QueuedLog[]>();
  const sent: string[] = [];
  const account = (userId: string) => new OfflineLogQueue({
    read: async () => stores.get(userId) ?? [],
    write: async (logs) => { stores.set(userId, logs); },
    send: async (item) => {
      sent.push(`${userId}:${item.id}`);
      if (userId === "alice") await gate;
      return result(item.id);
    },
    isPermanentError: () => false, message: String, changed: () => {}, synced: () => {},
  });
  const alice = account("alice");
  await alice.load();
  const first = alice.enqueue(log("first"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = alice.enqueue(log("second"));
  const bob = account("bob");
  await bob.enqueue(log("bob-log"));
  alice.close();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(sent, ["alice:first", "bob:bob-log"]);
  assert.equal(stores.get("alice")?.[0].id, "second");
  assert.equal(stores.get("bob")?.length, 0);
});
