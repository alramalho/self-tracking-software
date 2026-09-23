import { describe, expect, it } from "vitest";
import { notificationDestination } from "./notificationDestination";

describe("notification destinations", () => {
  it("opens the reacted activity and other timeline items", () => {
    expect(notificationDestination({ type: "INFO", relatedId: "entry-1", relatedData: { activityEntryId: "entry-1" } })).toBe("/?activityEntryId=entry-1");
    expect(notificationDestination({ type: "INFO", relatedId: "post-1", relatedData: { achievementPostId: "post-1" } })).toBe("/?achievementPostId=post-1");
  });

  it("routes messages, coaching, plans, and connection requests", () => {
    expect(notificationDestination({ type: "INFO", relatedId: "chat-1", relatedData: { chatId: "chat-1" } })).toBe("/chat/chat-1");
    expect(notificationDestination({ type: "COACH", relatedId: "chat-2", relatedData: null })).toBe("/chat/chat-2");
    expect(notificationDestination({ type: "COACH", relatedId: "chat-2", relatedData: { type: "COACH_ASSESSMENT" } })).toBe("/chat/chat-2");
    expect(notificationDestination({ type: "COACH", relatedId: "plan-1", relatedData: { planId: "plan-1" } })).toBe("/plan/plan-1");
    expect(notificationDestination({ type: "FRIEND_REQUEST", relatedId: "request-1", relatedData: { username: "alex" } })).toBe("/profile/alex");
  });

  it("keeps mixed or unknown notifications in the inbox", () => {
    expect(notificationDestination({ type: "INFO", relatedId: null, relatedData: null })).toBe("/notifications");
    expect(notificationDestination({ type: "PLAN_INVITATION", relatedId: "invitation-1", relatedData: { planGroupId: "group-1" } })).toBe("/notifications");
  });
});
