import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl ? new URL(databaseUrl) : null;
if (!database || database.pathname !== "/tracking_offline_test" ||
    database.hostname !== "localhost" ||
    database.searchParams.get("host") !== "/private/tmp/tracking-offline-pg-sock")
  throw new Error("This test only runs against the isolated tracking_offline_test database.");
process.env.WATCH_AUTH_SECRET = "local-offline-receipt-test-secret";
// Construct a local placeholder at runtime so no credential-shaped value is
// committed with this isolated database test.
process.env.CLERK_SECRET_KEY ??= `sk_${"test"}_${Buffer.from("local-offline-receipt-test").toString("base64")}`;
process.env.CLERK_PUBLISHABLE_KEY ??= `pk_test_${Buffer.from("local.clerk.test$").toString("base64")}`;

test("log replay and distinct concurrent photo uploads use one durable result", async () => {
  const [routeModule, prismaModule, watchModule, s3Module] = await Promise.all([
    import("../src/routes/activities"),
    import("../src/utils/prisma"),
    import("../src/services/auth/watchTokenService"),
    import("../src/services/s3Service"),
  ]);
  const activitiesRouter = routeModule.activitiesRouter ?? routeModule.default.activitiesRouter;
  const prisma = prismaModule.prisma ?? prismaModule.default.prisma;
  const issueWatchAuthTokens = watchModule.issueWatchAuthTokens ?? watchModule.default.issueWatchAuthTokens;
  const s3Service = s3Module.s3Service ?? s3Module.default.s3Service;
  const app = express();
  app.use("/activities", activitiesRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP test listener");
  const base = `http://127.0.0.1:${address.port}`;
  const userId = `offline-test-${Date.now()}`;
  const secondUserId = `${userId}-second`;
  const originalUpload = s3Service.upload.bind(s3Service);
  const originalGetUrl = s3Service.getPublicUrl.bind(s3Service);
  let photoUploads = 0;
  let releaseUploads!: () => void;
  const uploadBarrier = new Promise<void>((resolve) => { releaseUploads = resolve; });
  s3Service.upload = async (_buffer, key) => {
    photoUploads++;
    if (photoUploads === 2) releaseUploads();
    await uploadBarrier;
    return key;
  };
  s3Service.getPublicUrl = (key) => `https://fixture.invalid${key}`;
  try {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.test` } });
    await prisma.user.create({ data: { id: secondUserId, email: `${secondUserId}@example.test` } });
    const activity = await prisma.activity.create({ data: {
      userId, title: "Running", measure: "km", emoji: "🏃",
    } });
    const secondActivity = await prisma.activity.create({ data: {
      userId: secondUserId, title: "Running", measure: "km", emoji: "🏃",
    } });
    const token = issueWatchAuthTokens(userId).accessToken;
    const secondToken = issueWatchAuthTokens(secondUserId).accessToken;
    const datetime = new Date(Date.now() - 60_000).toISOString();
    const logKey = "0ac1d754-4db6-497d-a4fa-3de38da30001";
    const nextKey = "0ac1d754-4db6-497d-a4fa-3de38da30002";
    const log = (activityId: string, key: string, quantity: number, bearer = token) => {
      const form = new FormData();
      for (const [name, value] of Object.entries({ activityId,
        iso_date_string: datetime, timezone: "Europe/Lisbon",
        quantity: String(quantity), clientRequestId: key, description: "Receipt test",
        privateNotes: "Preserved privately", latitude: "38.7", longitude: "-9.1" }))
        form.append(name, value);
      return fetch(`${base}/activities/log-activity`, { method: "POST",
        headers: { Authorization: `Bearer ${bearer}` }, body: form });
    };
    const [first, replay] = await Promise.all([log(activity.id, logKey, 7), log(activity.id, logKey, 7)]);
    const firstText = await first.text();
    const replayText = await replay.text();
    assert.equal(first.status, 200, firstText);
    assert.equal(replay.status, 200, replayText);
    const firstBody = JSON.parse(firstText);
    const replayBody = JSON.parse(replayText);
    assert.equal(firstBody.entry.id, replayBody.entry.id);
    const storedLog = await prisma.activityEntry.findUniqueOrThrow({ where: { id: firstBody.entry.id } });
    assert.equal(storedLog.quantity, 7);
    assert.equal(storedLog.datetime.toISOString(), datetime);
    assert.equal(storedLog.privateNotes, "Preserved privately");
    assert.equal(storedLog.latitude, 38.7);
    assert.equal(await prisma.activityLogRequest.count({ where: { userId, requestId: logKey } }), 1);
    assert.equal((await log(activity.id, nextKey, 3)).status, 200);
    assert.equal((await prisma.activityEntry.findUniqueOrThrow({ where: { id: firstBody.entry.id } })).quantity, 10);
    assert.equal((await log(secondActivity.id, logKey, 2, secondToken)).status, 200);
    assert.equal(await prisma.activityLogRequest.count({ where: { requestId: logKey } }), 2);

    const photo = (key: string, name: string) => {
      const form = new FormData();
      form.append("clientRequestId", key);
      form.append("photos", new Blob([name], { type: "image/jpeg" }), name);
      return fetch(`${base}/activities/activity-entries/${firstBody.entry.id}/photo`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
    };
    const photoKey1 = "0ac1d754-4db6-497d-a4fa-3de38da30003";
    const photoKey2 = "0ac1d754-4db6-497d-a4fa-3de38da30004";
    const [photo1, photo2] = await Promise.all([photo(photoKey1, "a.jpg"), photo(photoKey2, "b.jpg")]);
    assert.equal(photo1.status, 200);
    assert.equal(photo2.status, 200);
    const entry = await prisma.activityEntry.findUniqueOrThrow({ where: { id: firstBody.entry.id } });
    assert.equal(entry.imageS3Paths.length, 2, "Concurrent distinct uploads must both survive.");
    assert.equal(await prisma.activityPhotoRequest.count({ where: { entryId: entry.id } }), 2);
    assert.equal((await photo(photoKey1, "a.jpg")).status, 200);
    assert.equal(photoUploads, 2, "A replay must skip the external upload.");
    assert.equal((await prisma.activityEntry.findUniqueOrThrow({ where: { id: entry.id } })).imageS3Paths.length, 2);
  } finally {
    s3Service.upload = originalUpload;
    s3Service.getPublicUrl = originalGetUrl;
    await prisma.user.deleteMany({ where: { id: { in: [userId, secondUserId] } } });
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
