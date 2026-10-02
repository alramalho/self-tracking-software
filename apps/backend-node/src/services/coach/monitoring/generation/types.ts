import type { ActivityEntry, PlanCurriculumFile, User } from "@tsw/prisma";
import type { PlanSupport } from "@tsw/prisma/follow-through";
import type { ActiveCoachPlan, CoachConversationMessage } from "../../types";
import type { MonitoringDecision, MonitoringGenerated } from "../types";

export interface ScheduledCoachInput {
  user: User;
  now: Date;
  decision: MonitoringDecision;
  plans: (ActiveCoachPlan & { curriculumFiles: PlanCurriculumFile[] })[];
  supports: Record<string, PlanSupport>;
  entries: ActivityEntry[];
  conversationHistory: CoachConversationMessage[];
  /** Plan session ids the coach asked about and got no reply (training plans only). */
  assumedMissedSessionIds: string[];
}

export interface ScheduledCoachGenerator {
  generate(input: ScheduledCoachInput): Promise<MonitoringGenerated>;
}
