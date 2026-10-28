// The iPhone app keeps the same copy in apps/frontend-expo/src/features/explore/model.ts.
import type {
  CircleTile,
  ExplorePerson,
  ExploreRow,
  ExploreSources,
  ExploreTile,
  PersonTile,
  RecommendedPlan,
  RecommendedUsers,
  SearchPerson,
} from "./types";

// The plan someone put first; newest wins when they never reordered.
export function mainPlan(plans: RecommendedPlan[]): RecommendedPlan | null {
  const active = plans.filter((plan) => !plan.archivedAt);
  const order = (plan: RecommendedPlan) => plan.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const created = (plan: RecommendedPlan) => (plan.createdAt ? Date.parse(plan.createdAt) : 0);
  return [...active].sort((a, b) => order(a) - order(b) || created(b) - created(a))[0] ?? null;
}

// People to follow, best match first, each with their main plan.
export function recommendedPeople(response: RecommendedUsers | undefined): ExplorePerson[] {
  if (!response) return [];
  const rank = new Map(response.recommendations.map((r, index) => [r.recommendationObjectId, index]));
  return response.users
    .filter((user) => !!user.username)
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
    .map((user) => {
      const plan = mainPlan(response.plans.filter((p) => p.userId === user.id));
      return {
        userId: user.id,
        username: user.username!,
        name: user.name ?? null,
        picture: user.picture ?? null,
        plan: plan ? { goal: plan.goal, emoji: plan.emoji ?? null } : null,
      };
    });
}

export const normalizeQuery = (text: string) => text.trim().replace(/^@/, "");

// Typed search: your own people first, then anyone suggested whose name or plan matches.
export function matchingPeople(query: string, connections: SearchPerson[], suggested: ExplorePerson[]): ExplorePerson[] {
  const q = normalizeQuery(query).toLowerCase();
  const known = new Map(suggested.map((person) => [person.userId, person]));
  const friends = connections.map((person) => known.get(person.userId) ?? {
    userId: person.userId,
    username: person.username,
    name: person.name ?? null,
    picture: person.picture ?? null,
    plan: null,
  });
  const matches = suggested.filter((person) =>
    [person.name, person.username, person.plan?.goal].some((text) => text?.toLowerCase().includes(q)),
  );
  return unique([...friends, ...matches], (person) => person.userId);
}

// Tall circle tiles alternate sides, with a row of two people between them.
// Once one kind runs out, the rest fill rows of two.
export function exploreRows({ circles, joinedCircleIds, people }: ExploreSources): ExploreRow[] {
  const joined = new Set(joinedCircleIds);
  const circleTiles: CircleTile[] = unique(circles, (card) => card.id).map((card) => ({
    kind: "circle",
    key: `circle-${card.id}`,
    circle: { card, joined: joined.has(card.id) },
  }));
  const personTiles: PersonTile[] = unique(people, (person) => person.userId).map((person) => ({
    kind: "person",
    key: `person-${person.userId}`,
    person,
  }));
  const rows: ExploreRow[] = [];
  let side: "left" | "right" = "left";
  while (circleTiles.length || personTiles.length) {
    if (circleTiles.length && personTiles.length >= 2) {
      const circle = circleTiles.shift()!;
      rows.push({ kind: "feature", key: circle.key, side, circle, people: [personTiles.shift()!, personTiles.shift()!] });
      side = side === "left" ? "right" : "left";
      if (personTiles.length >= 2) rows.push(pair(personTiles.splice(0, 2)));
    } else {
      const tiles: ExploreTile[] = personTiles.splice(0, 2);
      tiles.push(...circleTiles.splice(0, 2 - tiles.length));
      rows.push(pair(tiles));
    }
  }
  return rows;
}

const pair = (tiles: ExploreTile[]): ExploreRow => ({ kind: "pair", key: tiles.map((tile) => tile.key).join("+"), tiles });

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(key(item))) return false;
    seen.add(key(item));
    return true;
  });
}
