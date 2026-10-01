import { blockedUserIds } from "../../utils/blocks";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { notificationService } from "../notificationService";
import { userService } from "../userService";
import { requireMember } from "./board/service";
import { CIRCLE_CAP } from "./config";
import { CircleError } from "./errors";
import { recordCircleEvent } from "./events";
import { circleLabel } from "./notify";
import type { InvitableFriend } from "./types";

// The viewer's friends, minus anyone blocked either way or deleted.
async function friendsOf(userId: string) {
  const hidden = await blockedUserIds(userId);
  return (await userService.getUserConnections(userId)).filter(
    (friend) => !hidden.includes(friend.id) && !friend.deletedAt,
  );
}

// Who a member can invite from inside the app: their friends, with who's already in or invited.
export async function invitableFriends(userId: string, circleId: string): Promise<InvitableFriend[]> {
  await requireMember(userId, circleId);
  const friends = await friendsOf(userId);
  const ids = friends.map((friend) => friend.id);
  const [members, invited] = await Promise.all([
    prisma.circleMember.findMany({ where: { circleId, userId: { in: ids } }, select: { userId: true } }),
    prisma.circleEvent.findMany({ where: { circleId, kind: "INVITED", userId: { in: ids } }, select: { userId: true } }),
  ]);
  const inCircle = new Set(members.map((m) => m.userId));
  const alreadyInvited = new Set(invited.map((e) => e.userId));
  return friends.map((friend) => ({
    userId: friend.id,
    name: friend.name,
    username: friend.username,
    picture: friend.picture,
    state: inCircle.has(friend.id) ? "member" : alreadyInvited.has(friend.id) ? "invited" : "open",
  }));
}

// One invite per friend per circle: a notification that opens the circle's join screen.
// Friends only, so nobody gets circle invites from strangers.
export async function inviteFriend(inviterId: string, circleId: string, friendId: string): Promise<void> {
  await requireMember(inviterId, circleId);
  const [friend] = (await invitableFriends(inviterId, circleId)).filter((f) => f.userId === friendId);
  if (!friend) throw new CircleError("You can only invite your friends");
  if (friend.state !== "open") return;
  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    select: { id: true, name: true, emoji: true, inviteCode: true, _count: { select: { members: true } } },
  });
  if (circle._count.members >= CIRCLE_CAP) throw new CircleError("This circle is full");
  const inviter = await prisma.user.findUniqueOrThrow({ where: { id: inviterId }, select: { name: true, username: true } });
  await recordCircleEvent("INVITED", { userId: friendId, circleId });
  try {
    await notificationService.createAndProcessNotification({
      userId: friendId,
      type: "CIRCLE",
      title: `${inviter.name?.split(" ")[0] ?? inviter.username ?? "A friend"} invited you to a circle`,
      message: `${circleLabel(circle)}. Tap to see who's in.`,
      relatedId: circle.id,
      relatedData: { url: `/circle-invite/${circle.inviteCode}`, circleId: circle.id },
    });
  } catch (error) {
    logger.error("Could not send a circle invite", { circleId, friendId, error });
    throw new CircleError("Couldn't send the invite. Please try again.");
  }
}
