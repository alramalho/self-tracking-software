import { subDays } from "date-fns";
import { prisma } from "../../utils/prisma";
import { previewFor } from "./previews";
import { weeklyTarget } from "./matching/profiles";
import type { CircleCard, Reason } from "./types";

const PREVIEW_SQUARES = 4;

export function paceLabel(targets: number[]): string | null {
  if (!targets.length) return null;
  const low = Math.min(...targets);
  const high = Math.max(...targets);
  return low === high ? `${low} a week` : `${low}–${high} a week`;
}

// A place is only shown when most members share it.
export function sharedPlace(places: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const place of places) if (place) counts.set(place, (counts.get(place) ?? 0) + 1);
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] * 2 > places.length ? best[0] : null;
}

// Circle summaries for people deciding whether to join. Photos only appear as
// blurred previews; names are first names with each person's plan goal.
export async function circleCards(
  circleIds: string[],
  reasonsById: Map<string, Reason[]> = new Map(),
  hidden: string[] = [],
): Promise<CircleCard[]> {
  if (!circleIds.length) return [];
  const circles = await prisma.circle.findMany({
    where: { id: { in: circleIds } },
    select: {
      id: true,
      name: true,
      emoji: true,
      status: true,
      members: {
        where: { userId: { notIn: hidden }, user: { deletedAt: null } },
        orderBy: { joinedAt: "asc" },
        select: {
          planId: true,
          joinedAt: true,
          user: { select: { name: true, picture: true, approxPlace: true } },
          plan: {
            select: {
              goal: true,
              timesPerWeek: true,
              coachSuggestedTimesPerWeek: true,
              progressState: true,
            },
          },
        },
      },
    },
  });
  const weekAgo = subDays(new Date(), 7);
  const cards = await Promise.all(
    circles.map(async (circle) => {
      const memberLogs = circle.members.map((m) => ({
        activity: { plans: { some: { id: m.planId } } },
        datetime: { gte: m.joinedAt > weekAgo ? m.joinedAt : weekAgo },
      }));
      const [logsThisWeek, photos] = await Promise.all([
        prisma.activityEntry.count({ where: { deletedAt: null, OR: memberLogs } }),
        prisma.activityEntry.findMany({
          where: {
            deletedAt: null,
            OR: memberLogs,
            imageUrls: { isEmpty: false },
          },
          orderBy: { datetime: "desc" },
          take: 20,
          select: {
            id: true,
            imagePreview: true,
            imageS3Paths: true,
            imageS3Path: true,
            imageUrls: true,
            imageUrl: true,
          },
        }),
      ]);
      const previews = (
        await Promise.all(photos.slice(0, PREVIEW_SQUARES).map(previewFor))
      ).filter((p): p is string => !!p);
      const card: CircleCard = {
        id: circle.id,
        name: circle.name,
        emoji: circle.emoji,
        status: circle.status,
        place: sharedPlace(circle.members.map((m) => m.user.approxPlace)),
        memberCount: circle.members.length,
        paceLabel: paceLabel(circle.members.map((m) => weeklyTarget(m.plan))),
        logsThisWeek,
        previews,
        morePhotos: Math.max(0, photos.length - previews.length),
        reasons: reasonsById.get(circle.id) ?? [],
        members: circle.members.map((m) => ({
          name: m.user.name?.split(" ")[0] ?? null,
          goal: m.plan.goal,
          picture: m.user.picture,
        })),
      };
      return card;
    }),
  );
  const order = new Map(circleIds.map((id, i) => [id, i]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
