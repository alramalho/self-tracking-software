import type { HomeDay, HomeDayItem } from "@tsw/prisma/home-todo";
import type { ActivityEntry, Plan } from "@/core/types";
export interface HomeTodoProps {
  plans: Plan[];
  entries: ActivityEntry[];
}
export interface HomeTileItemProps {
  item: HomeDayItem;
}
export interface HomeDayTileProps {
  day: HomeDay;
  selected: boolean;
  onPress: () => void;
}
export interface HomeDayDetailProps {
  day: HomeDay;
  todayKey: string;
}
export interface HomeItemRowProps {
  item: HomeDayItem;
  canLog: boolean;
  logDate: Date;
}
