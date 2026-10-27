import type { HomeDay, HomeDayItem } from "@tsw/prisma/home-todo";

export interface HomeDayTileProps {
  day: HomeDay;
  selected: boolean;
  onClick: () => void;
}

export interface HomeDayDetailProps {
  day: HomeDay;
  todayKey: string;
}

export interface HomeItemRowProps {
  item: HomeDayItem;
  canLog: boolean;
}
