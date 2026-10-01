import { prisma } from "../../utils/prisma";
import { circleCards } from "../circles/cards";
import { ACTIVE_AT, CIRCLE_CAP } from "../circles/config";
import type { CircleCard } from "../circles/types";
import { ORBIT_SEATS, type OgCard } from "./card";

// Two title lines hold about this many characters before the art on the right.
const NAME_MAX = 34;

export interface CircleInvite {
  card: CircleCard;
  // The owner's first name, for "Rita invited you to a circle".
  owner: string;
}

export async function findCircleInvite(inviteCode: string): Promise<CircleInvite | null> {
  const circle = await prisma.circle.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      members: {
        where: { role: "OWNER", user: { deletedAt: null } },
        take: 1,
        select: { user: { select: { name: true, username: true } } },
      },
    },
  });
  if (!circle) return null;
  const [card] = await circleCards([circle.id], new Map(), []);
  if (!card) return null;
  const user = circle.members[0]?.user;
  return { card, owner: user?.name?.trim().split(/\s+/)[0] || user?.username || "A friend" };
}

// A circle is still forming until two people have posted their proof.
const isForming = (card: CircleCard) => card.memberCount < ACTIVE_AT;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function shortName(name: string): string {
  const chars = [...name.trim()];
  return chars.length > NAME_MAX ? `${chars.slice(0, NAME_MAX - 1).join("").trim()}…` : chars.join("");
}

// The preview image: what the circle is, who invited you, and proof that people are posting.
export function inviteOgCard({ card, owner }: CircleInvite): OgCard {
  const forming = isForming(card);
  const spots = `${card.memberCount} of ${CIRCLE_CAP} spots`;
  return {
    art: forming ? "start" : "circle",
    kicker: forming ? `${owner} started a circle` : `${owner} invited you to a circle`,
    title: `${card.emoji} ${shortName(card.name)}`,
    sub: [card.paceLabel, card.place].filter(Boolean).join(" · ") || null,
    previews: forming ? [] : card.previews,
    meta: forming
      ? "Be one of the first. Post a photo to join."
      : card.logsThisWeek > 0
        ? `${plural(card.logsThisWeek, "session")} posted this week · ${spots}`
        : spots,
    orbit: {
      // Only the people who get a seat, so no other photo is fetched.
      members: card.members.slice(0, ORBIT_SEATS).map((member) => ({
        initial: [...(member.name?.trim() || "?")][0].toUpperCase(),
        picture: member.picture,
      })),
      openSpots: forming ? 3 : card.memberCount < CIRCLE_CAP ? 1 : 0,
    },
  };
}

// The preview's title and description, for the page's meta tags.
export function inviteMeta({ card, owner }: CircleInvite): { title: string; description: string } {
  const others = card.memberCount - 1;
  return {
    title: `Join ${card.emoji} ${card.name}`,
    description: isForming(card)
      ? `${owner} started this circle. Be one of the first: post a photo from a session to join.`
      : `${owner} and ${plural(others, "other")} are in. Post a photo from a session to join.`,
  };
}

// The rendered image is reused until one of these changes.
export const inviteCacheKey = (inviteCode: string, card: CircleCard) =>
  [inviteCode, card.name, card.memberCount, card.logsThisWeek].join("|");
