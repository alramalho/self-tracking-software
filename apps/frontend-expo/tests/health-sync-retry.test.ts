import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import {
  isTransientHealthError,
  nextHealthSyncRetryDelay,
} from "../src/features/health/sync-retry";

test("health sync retries gateway outages and network failures", () => {
  assert.equal(
    isTransientHealthError(
      new axios.AxiosError("bad gateway", "ERR_BAD_RESPONSE", undefined, undefined, {
        status: 502,
      } as never),
    ),
    true,
  );
  assert.equal(isTransientHealthError(new axios.AxiosError("offline", "ERR_NETWORK")), true);
  assert.equal(isTransientHealthError(new Error("validation failed")), false);
});

test("health sync retry delays back off and stop after the retry window", () => {
  assert.equal(nextHealthSyncRetryDelay(0), 5_000);
  assert.equal(nextHealthSyncRetryDelay(3), 60_000);
  assert.equal(nextHealthSyncRetryDelay(5), 300_000);
  assert.equal(nextHealthSyncRetryDelay(6), null);
});
