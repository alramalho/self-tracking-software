import type { GroupMemberProgress, GroupMemberStatus } from "../types";

export const statusLabels: Record<GroupMemberStatus | "NULL", string> = {
  COMPLETED: "Completed",
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  FAILED: "Off Track",
  NULL: "Not Tracked",
};

export const statusColors: Record<GroupMemberStatus, string> = {
  COMPLETED: "#3a9157",
  ON_TRACK: "#40a362",
  AT_RISK: "#e0a339",
  FAILED: "#d94f4f",
};

// Members without coach automation keep the accent colour; tracked members are
// coloured by how their week is going, and grey when no status exists yet.
export function memberBarColor(
  member: Pick<GroupMemberProgress, "hasCoachAutomation" | "status">,
  accent: string,
  muted: string,
) {
  if (!member.hasCoachAutomation) return accent;
  return member.status ? statusColors[member.status] : muted;
}

export const chartMax = (members: GroupMemberProgress[]) =>
  Math.max(1, ...members.flatMap((m) => [m.weeklyActivityCount, m.target]));
