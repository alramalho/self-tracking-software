import type { ReactNode } from "react";
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
  testPrefix: string;
}
export interface TwoWeeksProps {
  weeks: HomeDay[][];
  selectedKey: string;
  onSelect: (key: string) => void;
  testPrefix?: string;
}
export interface HomeDayDetailProps {
  day: HomeDay;
  todayKey: string;
  testID?: string;
  children?: ReactNode;
}
export interface HomeItemRowProps {
  item: HomeDayItem;
  canLog: boolean;
  logDate: Date;
}
export interface HomeProgressProps {
  rows: import("@tsw/prisma/home-todo").HomeProgressRow[];
}
export interface HomeStepsProps {
  value: number;
  target: number;
  color: string;
  label: string;
}
