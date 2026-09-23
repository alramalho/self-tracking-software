const assert = require("node:assert/strict");
const { test } = require("node:test");
const { verifyUploadedState } = require("./offline-photo-run.cjs");

function state() {
  return {
    entries: [{ id: "entry-1", quantity: 7, description: "Offline photo proof",
      imageUrls: ["http://127.0.0.1:4319/__background.png?photo=req-1-0"] }],
    requests: [
      { method: "POST", path: "/activities/log-activity",
        body: { description: "Offline photo proof", clientRequestId: "req-1" } },
      { method: "POST", path: "/activities/log-activity",
        body: { description: "Offline photo proof", clientRequestId: "req-1" } },
      { method: "POST", path: "/activities/log-activity",
        body: { description: "Offline photo proof", clientRequestId: "req-1" } },
      { method: "PUT", path: "/activities/activity-entries/entry-1/photo",
        body: { clientRequestId: "req-1", uploadedPhotos: [
          { name: "icon.png", size: 1024, type: "image/png" },
        ] } },
    ],
  };
}

test("accepts one persisted activity and real photo after a lost response", () => {
  verifyUploadedState(state(), 1);
});

test("rejects duplicate entries and missing uploaded image bytes", () => {
  const duplicated = state();
  duplicated.entries.push({ ...duplicated.entries[0], id: "entry-2" });
  assert.throws(() => verifyUploadedState(duplicated, 1), /exactly one activity/);
  const empty = state();
  empty.requests[3].body.uploadedPhotos[0].size = 0;
  assert.throws(() => verifyUploadedState(empty, 1), /actual image file/);
});

test("accepts an idempotent photo retry only when it keeps one stored image", () => {
  const retried = state();
  retried.requests.push({ ...retried.requests[3] });
  verifyUploadedState(retried, 1);
  retried.entries[0].imageUrls.push("http://127.0.0.1:4319/duplicate.png");
  assert.throws(() => verifyUploadedState(retried, 1), /exactly one uploaded photo/);
});
