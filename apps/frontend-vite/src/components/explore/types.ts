import type { CircleCard } from "../circles/types";

// What /users/recommended-users returns, trimmed to what the grid shows.
export interface RecommendedUsers {
  recommendations: { recommendationObjectId: string; score: number }[];
  users: { id: string; username?: string | null; name?: string | null; picture?: string | null }[];
  plans: RecommendedPlan[];
}

export interface RecommendedPlan {
  id: string;
  userId: string;
  goal: string;
  emoji?: string | null;
  sortOrder?: number | null;
  createdAt?: string | null;
  archivedAt?: string | null;
}

// /users/search-users only searches your own connections.
export interface SearchPerson {
  userId: string;
  username: string;
  name?: string | null;
  picture?: string | null;
}

export interface ExplorePerson {
  userId: string;
  username: string;
  name: string | null;
  picture: string | null;
  plan: { goal: string; emoji: string | null } | null;
}

export interface ExploreCircle {
  card: CircleCard;
  // Already a member: the tile opens the circle instead of the join sheet.
  joined: boolean;
}

export type ExploreTile =
  | { kind: "circle"; key: string; circle: ExploreCircle }
  | { kind: "person"; key: string; person: ExplorePerson };

export type CircleTile = Extract<ExploreTile, { kind: "circle" }>;
export type PersonTile = Extract<ExploreTile, { kind: "person" }>;

// A tall circle beside two stacked people, or two tiles side by side.
export type ExploreRow =
  | { kind: "feature"; key: string; side: "left" | "right"; circle: CircleTile; people: [PersonTile, PersonTile] }
  | { kind: "pair"; key: string; tiles: ExploreTile[] };

export interface ExploreSources {
  circles: CircleCard[];
  joinedCircleIds: string[];
  people: ExplorePerson[];
}

export interface ExploreGridProps {
  rows: ExploreRow[];
  onOpenCircle: (circle: ExploreCircle) => void;
  onOpenPerson: (person: ExplorePerson) => void;
}

export interface TileProps<T> {
  tile: T;
  size: "tall" | "square";
  onPress: () => void;
}

export interface FacesProps {
  circle: ExploreCircle;
  onPhoto: boolean;
}
