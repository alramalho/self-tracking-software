# Notification Batching Design

## Problem
Currently, every social interaction (reaction, comment, friend posting a photo, achievement, etc.) sends an **immediate** push notification. This can be noisy — e.g., 5 friends reacting to your activity = 5 separate push notifications.

## Proposal: Batch social notifications, deliver once daily at 20:00 local time

### Core Idea

Instead of calling `createAndProcessNotification()` (which sends a push immediately), **batchable** notification types will call a new `createBatchedNotification()` method that:
1. Saves the notification to DB with status `BATCHED` (no push sent yet)
2. A new hourly cron job checks: "is it 20:00 in this user's timezone?" → if yes, aggregates & sends one push per category

### What gets batched vs. what stays immediate

| Category | Example | Batched? |
|---|---|---|
| **Reactions to your activity** | `@alice reacted to your activity with 🔥` | ✅ Batched |
| **Comments on your activity** | `@alice commented on your activity: "nice!"` | ✅ Batched |
| **Reactions to your achievement** | (achievement post reactions) | ✅ Batched |
| **Comments on your achievement** | `@alice commented on your achievement` | ✅ Batched |
| **Friend posted photo/activity** | `alice logged 5km of 🏃 Running with a photo 📸!` | ✅ Batched |
| **Friend shared achievement** | `alice shared a milestone for 🏃 Running! 🎉` | ✅ Batched |
| **Mentions in comments** | `@alice mentioned you in a comment` | ✅ Batched |
| **Connection request** | `alice sent you a connection request` | ❌ Immediate |
| **Connection accepted/rejected** | `alice accepted your connection request` | ❌ Immediate |
| **Coach / AI messages** | Coaching notifications, reminders | ❌ Immediate |
| **Direct messages (chat)** | `New message from alice` | ❌ Immediate |
| **Plan invitations** | Plan group invite | ❌ Immediate |
| **Referral joined** | `alice joined through your invite!` | ❌ Immediate |

**Rule of thumb**: Social feed noise → batch. Direct personal actions → immediate.

### Batching Categories (for aggregation)

When delivering at 20:00, notifications are grouped into categories and sent as **one push per category** (max ~4-5 pushes total):

1. **`REACTIONS`** — All reactions (activity + achievement) aggregated
   - Push: `"🔥 3 people reacted to your activities today"` or `"@alice and 2 others reacted to your activities"`
2. **`COMMENTS`** — All comments (activity + achievement) aggregated
   - Push: `"💬 2 new comments on your posts today"`
3. **`FRIEND_ACTIVITY`** — Friends posting photos / logging with photos + friend achievements
   - Push: `"📸 3 friends shared updates today"` or `"@alice and 2 others shared updates today"`
4. **`MENTIONS`** — Comment mentions
   - Push: `"@alice mentioned you in 2 comments today"`

### Schema Changes

```prisma
// Add to NotificationStatus enum:
enum NotificationStatus {
  PENDING
  BATCHED      // ← NEW: saved but not yet delivered as push
  PROCESSED
  OPENED
  CONCLUDED
}

// Add to Notification model:
model Notification {
  // ... existing fields ...
  batchCategory  String?   // e.g. "REACTIONS", "COMMENTS", "FRIEND_ACTIVITY", "MENTIONS"
}
```

### Code Changes

#### 1. `notificationService.ts` — New method

```ts
async createBatchedNotification(data: CreateNotificationData & {
  batchCategory: string
}): Promise<Notification> {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || "INFO",
      relatedId: data.relatedId,
      relatedData: data.relatedData,
      batchCategory: data.batchCategory,
      status: "BATCHED",
    },
  });
}
```

#### 2. `notificationService.ts` — New delivery method

```ts
async processBatchedNotifications(userId: string): Promise<void> {
  // 1. Find all BATCHED notifications for user, grouped by batchCategory
  const batched = await prisma.notification.findMany({
    where: { userId, status: "BATCHED" },
  });

  if (batched.length === 0) return;

  // 2. Group by batchCategory
  const groups = groupBy(batched, n => n.batchCategory);

  // 3. For each category, build summary message & send ONE push
  for (const [category, notifications] of Object.entries(groups)) {
    const summary = this.buildBatchSummary(category, notifications);

    // Send a single push for this category
    await this.sendPushNotification(userId, summary.title, summary.body);

    // Mark all as PROCESSED
    await prisma.notification.updateMany({
      where: { id: { in: notifications.map(n => n.id) } },
      data: { status: "PROCESSED", processedAt: new Date(), sentAt: new Date() },
    });
  }
}
```

#### 3. `cronScheduler.ts` — New hourly check

Add to the existing hourly cron job (which already runs every hour):

```ts
// Inside executeHourlyJob():
await this.processBatchedNotificationsForEligibleUsers();
```

```ts
private async processBatchedNotificationsForEligibleUsers(): Promise<void> {
  // Get all users who have BATCHED notifications
  const usersWithBatched = await prisma.notification.findMany({
    where: { status: "BATCHED" },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of usersWithBatched) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) continue;

    // Check if it's 20:00 in the user's timezone
    if (this.isUserTimezoneHour(user, 20)) {
      await notificationService.processBatchedNotifications(userId);
    }
  }
}
```

This uses the **existing** `isUserTimezoneHour()` method already in `recurringJobService.ts`.

#### 4. Callsites — Switch batchable notifications

Replace `createAndProcessNotification` with `createBatchedNotification` at these locations:

| File | Line | What | batchCategory |
|---|---|---|---|
| `activities.ts` | :683 | Reaction to activity (add) | `REACTIONS` |
| `activities.ts` | :768 | Reaction to activity (toggle) | `REACTIONS` |
| `activities.ts` | :994 | Comment on activity | `COMMENTS` |
| `activities.ts` | :1045 | Mention in activity comment | `MENTIONS` |
| `activities.ts` | :211 | Friend logged activity with photo | `FRIEND_ACTIVITY` |
| `achievements.ts` | :149 | Friend shared achievement | `FRIEND_ACTIVITY` |
| `achievements.ts` | :535 | Comment on achievement | `COMMENTS` |
| `achievements.ts` | :582 | Mention in achievement comment | `MENTIONS` |

Everything else (connection requests, chat messages, coach, reminders, plan invitations, referrals) stays as `createAndProcessNotification`.

### Summary of files to change

1. **`packages/prisma/schema.prisma`** — Add `BATCHED` status + `batchCategory` field
2. **`apps/backend-node/src/services/notificationService.ts`** — Add `createBatchedNotification()`, `processBatchedNotifications()`, `buildBatchSummary()`
3. **`apps/backend-node/src/services/recurringJobService.ts`** — Add batched notification processing to hourly job
4. **`apps/backend-node/src/routes/activities.ts`** — Switch 5 callsites to batched
5. **`apps/backend-node/src/routes/achievements.ts`** — Switch 3 callsites to batched
6. **Prisma migration** — `npx prisma migrate dev`

### Why this is simple

- Reuses the **existing hourly cron** (no new scheduler needed)
- Reuses the **existing `isUserTimezoneHour()`** helper
- Reuses the **existing `sendPushNotification()`** for delivery
- Only adds 1 new DB field (`batchCategory`) and 1 new enum value (`BATCHED`)
- Individual notifications are still stored in DB (viewable in notification center), just aggregated for push delivery
- No new infrastructure (no queues, no new cron jobs)
