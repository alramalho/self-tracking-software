import { test } from "node:test";
import assert from "node:assert/strict";
import { newDraft, stepOrder, canContinue } from "../src/features/onboarding/model";
import { notificationRoute } from "../src/native/notification-routing";
test("flexible tracking skips scheduling and coaching questions", () => {
 const draft = newDraft("local"); const steps = stepOrder(draft);
 assert.ok(!steps.includes("time")); assert.ok(!steps.includes("days")); assert.ok(!steps.includes("followup")); assert.ok(!steps.includes("checkIn")); assert.ok(steps.includes("nextStep"));
});
test("timed coaching asks the fields that power sessions and independent consent", () => {
 const draft = { ...newDraft("local"), commitment: "TIMED" as const, wantsCoaching: true, resourceName: "Pickup Music" }; const steps = stepOrder(draft);
 for (const step of ["days", "time", "link", "followup", "reminder", "checkIn", "weeklyReview"]) assert.ok(steps.includes(step));
});
test("impossible schedules and unsafe resource links cannot continue", () => {
 const draft = newDraft("local"); assert.equal(canContinue({...draft,step:"days",weekdays:[1,2,3,4],frequency:3}),false);
 assert.equal(canContinue({...draft,step:"time",time:"25:60"}),false);
 assert.equal(canContinue({...draft,step:"link",resourceUrl:"javascript:alert(1)"}),false);
 assert.equal(canContinue({...draft,step:"link",resourceUrl:"https://www.pickupmusic.com"}),true);
});
test("notification taps allow internal session navigation and reject external payloads", () => {
 assert.equal(notificationRoute("/session/repeat%3Ap%3A2026-09-16?check=1"),"/session/repeat%3Ap%3A2026-09-16?check=1");
 assert.equal(notificationRoute("trackingso://session/id"),"/session/id");
 assert.equal(notificationRoute("https://evil.test/session/id"),null);
 assert.equal(notificationRoute("//evil.test"),null);
 assert.equal(notificationRoute({url:"/plans"}),null);
});

test("session log dates stay on the session day across the date line", async () => {
  const { sessionDay, sessionLogDate } = await import("../src/features/follow-through/dates");
  for (const zone of ["Pacific/Kiritimati", "America/Los_Angeles", "Europe/Lisbon", "Pacific/Pago_Pago"]) {
    for (const day of ["2026-03-29", "2026-11-01", "2026-09-15"]) {
      assert.equal(sessionDay(sessionLogDate(day, zone, new Date("2026-01-01Z")), zone), day);
    }
  }
});
