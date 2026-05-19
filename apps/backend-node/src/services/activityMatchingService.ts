import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolatePosition(
  points: Array<{ latitude: number; longitude: number; timestamp: Date }>,
  targetTime: number
): { latitude: number; longitude: number } | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];

  const ts = targetTime;
  // Before first point
  if (ts <= points[0].timestamp.getTime()) return points[0];
  // After last point
  if (ts >= points[points.length - 1].timestamp.getTime())
    return points[points.length - 1];

  // Find the two surrounding points
  for (let i = 0; i < points.length - 1; i++) {
    const t0 = points[i].timestamp.getTime();
    const t1 = points[i + 1].timestamp.getTime();
    if (ts >= t0 && ts <= t1) {
      const ratio = t1 === t0 ? 0 : (ts - t0) / (t1 - t0);
      return {
        latitude:
          points[i].latitude + ratio * (points[i + 1].latitude - points[i].latitude),
        longitude:
          points[i].longitude +
          ratio * (points[i + 1].longitude - points[i].longitude),
      };
    }
  }
  return points[points.length - 1];
}

const TIME_OVERLAP_THRESHOLD = 0.7;
const AVG_DISTANCE_THRESHOLD = 100; // meters
const MAX_DISTANCE_THRESHOLD = 500; // meters
const SAMPLE_POINTS = 20;

export async function findAndCreateSharedActivities(
  newEntryId: string,
  userId: string
): Promise<void> {
  try {
    const newEntry = await prisma.activityEntry.findUnique({
      where: { id: newEntryId },
      include: {
        locationPoints: { orderBy: { timestamp: "asc" } },
      },
    });

    if (
      !newEntry ||
      !newEntry.isLiveTracked ||
      !newEntry.startedAt ||
      !newEntry.endedAt
    ) {
      return;
    }

    // Get connected user ids
    const connections = await prisma.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ fromId: userId }, { toId: userId }],
      },
    });

    const connectedUserIds = connections.map((c) =>
      c.fromId === userId ? c.toId : c.fromId
    );

    if (connectedUserIds.length === 0) return;

    // Find candidate entries: live-tracked, from connected users, within time window
    const windowMs = 30 * 60 * 1000; // 30 min buffer
    const candidates = await prisma.activityEntry.findMany({
      where: {
        userId: { in: connectedUserIds },
        isLiveTracked: true,
        deletedAt: null,
        startedAt: {
          gte: new Date(newEntry.startedAt.getTime() - windowMs),
          lte: new Date(newEntry.endedAt.getTime() + windowMs),
        },
      },
      include: {
        locationPoints: { orderBy: { timestamp: "asc" } },
      },
    });

    for (const candidate of candidates) {
      if (!candidate.startedAt || !candidate.endedAt) continue;

      // 1. Check time overlap
      const overlapStart = Math.max(
        newEntry.startedAt.getTime(),
        candidate.startedAt.getTime()
      );
      const overlapEnd = Math.min(
        newEntry.endedAt.getTime(),
        candidate.endedAt.getTime()
      );
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);

      const newDuration =
        newEntry.endedAt.getTime() - newEntry.startedAt.getTime();
      const candidateDuration =
        candidate.endedAt.getTime() - candidate.startedAt.getTime();
      const shorterDuration = Math.min(newDuration, candidateDuration);

      if (shorterDuration === 0) continue;
      const overlapRatio = overlapDuration / shorterDuration;
      if (overlapRatio < TIME_OVERLAP_THRESHOLD) continue;

      // 2. Check location proximity (sample time-aligned points)
      if (
        newEntry.locationPoints.length < 2 ||
        candidate.locationPoints.length < 2
      ) {
        continue;
      }

      const sampleStart = overlapStart;
      const sampleEnd = overlapEnd;
      const sampleInterval = (sampleEnd - sampleStart) / SAMPLE_POINTS;

      let totalDistance = 0;
      let maxDistance = 0;
      let validSamples = 0;

      for (let i = 0; i <= SAMPLE_POINTS; i++) {
        const t = sampleStart + i * sampleInterval;
        const posNew = interpolatePosition(
          newEntry.locationPoints as Array<{
            latitude: number;
            longitude: number;
            timestamp: Date;
          }>,
          t
        );
        const posCandidate = interpolatePosition(
          candidate.locationPoints as Array<{
            latitude: number;
            longitude: number;
            timestamp: Date;
          }>,
          t
        );

        if (!posNew || !posCandidate) continue;

        const dist = haversineDistance(
          posNew.latitude,
          posNew.longitude,
          posCandidate.latitude,
          posCandidate.longitude
        );
        totalDistance += dist;
        maxDistance = Math.max(maxDistance, dist);
        validSamples++;
      }

      if (validSamples === 0) continue;

      const avgDistance = totalDistance / validSamples;
      if (
        avgDistance > AVG_DISTANCE_THRESHOLD ||
        maxDistance > MAX_DISTANCE_THRESHOLD
      ) {
        continue;
      }

      // Match found! Create or extend SharedActivity
      const existingShared = await prisma.sharedActivityEntry.findFirst({
        where: { activityEntryId: candidate.id },
      });

      if (existingShared) {
        // Add new entry to existing shared activity
        const alreadyLinked = await prisma.sharedActivityEntry.findFirst({
          where: {
            sharedActivityId: existingShared.sharedActivityId,
            activityEntryId: newEntryId,
          },
        });
        if (!alreadyLinked) {
          await prisma.sharedActivityEntry.create({
            data: {
              sharedActivityId: existingShared.sharedActivityId,
              activityEntryId: newEntryId,
            },
          });
        }
      } else {
        // Create new shared activity with both entries
        await prisma.sharedActivity.create({
          data: {
            entries: {
              create: [
                { activityEntryId: newEntryId },
                { activityEntryId: candidate.id },
              ],
            },
          },
        });
      }

      logger.info(
        `Created shared activity between entries ${newEntryId} and ${candidate.id}`
      );
      // Only link to the first match found (can be extended later)
      break;
    }
  } catch (error) {
    logger.error("Error in activity matching:", error);
    // Non-fatal: don't break the activity logging flow
  }
}
