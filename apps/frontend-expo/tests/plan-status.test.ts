import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentSyncLabel,
  agentSyncTier,
  inactivePlanStatus,
  isPlanActive,
  isPlanInactive,
  maxPlans,
} from "../src/features/plans/plan-status";

const now = new Date("2026-10-19T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

test("expired and archived plans are inactive and leave the default grid", () => {
  const expired = { finishingDate: daysAgo(1) };
  const archived = { archivedAt: daysAgo(10) };
  assert.equal(isPlanInactive(expired, now), true);
  assert.equal(isPlanInactive(archived, now), true);
  assert.equal(isPlanActive({ finishingDate: daysAgo(-5) }, now), true);
  assert.equal(isPlanActive({ deletedAt: daysAgo(1) }, now), false);
});

test("the manage sheet names why a plan is inactive", () => {
  assert.equal(
    inactivePlanStatus({ finishingDate: daysAgo(1) }, now),
    "This plan has expired",
  );
  assert.equal(
    inactivePlanStatus({ archivedAt: daysAgo(1) }, now),
    "This plan is archived",
  );
  assert.equal(
    inactivePlanStatus({ archivedAt: daysAgo(1), finishingDate: daysAgo(1) }, now),
    "This plan is archived and expired",
  );
});

test("free accounts keep one plan, paid accounts keep many", () => {
  assert.equal(maxPlans("FREE"), 1);
  assert.equal(maxPlans(undefined), 1);
  assert.equal(maxPlans("PLUS"), 100);
});

test("connected agent sync follows the backend fresh, stale, dark ladder", () => {
  assert.equal(agentSyncTier(daysAgo(1), now), "fresh");
  assert.equal(agentSyncTier(daysAgo(4), now), "stale");
  assert.equal(agentSyncTier(null, now), "stale");
  assert.equal(agentSyncTier(daysAgo(8), now), "dark");
  assert.equal(agentSyncLabel(daysAgo(8), now), "Teacher quiet · coach took over");
  assert.equal(agentSyncLabel(null, now), "Teacher · never synced");
});

test("plan metric insights wait for a week of check-ins", async () => {
  const { metricsWithInsights } = await import("../src/features/metrics/model");
  const metrics = [
    { id: "energy", title: "Energy", emoji: "⚡" },
    { id: "mood", title: "Mood", emoji: "🙂" },
  ];
  const entries = [
    ...Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, metricId: "energy", rating: 3, createdAt: daysAgo(i) })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, metricId: "mood", rating: 3, createdAt: daysAgo(i) })),
  ];
  assert.deepEqual(
    metricsWithInsights(metrics, entries as never).map((m) => m.id),
    ["energy"],
  );
});

test("group bars use the accent unless coach automation tracks the member", async () => {
  const { memberBarColor, chartMax } = await import("../src/features/plans/group/group-progress");
  assert.equal(memberBarColor({ hasCoachAutomation: false, status: "FAILED" }, "#accent", "#muted"), "#accent");
  assert.equal(memberBarColor({ hasCoachAutomation: true, status: null }, "#accent", "#muted"), "#muted");
  assert.equal(memberBarColor({ hasCoachAutomation: true, status: "AT_RISK" }, "#accent", "#muted"), "#e0a339");
  assert.equal(chartMax([]), 1);
});
