import type { DesignSession } from "@tsw/prisma/follow-through";

export {
  addDay,
  clock,
  dayNumber,
  liftText,
  longDate,
  paceText,
  shortDate,
  unitLabel,
  weekRange,
  weekday,
} from "@tsw/prisma/follow-through/session-format";

export const sessionsOn = (sessions: DesignSession[], day: string) => sessions.filter((s) => s.date === day);
