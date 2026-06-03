import {
  Activity,
  Plan,
  PlanMilestone,
  PlanSession,
  Prisma,
} from "@tsw/prisma";
import { z } from "zod/v4";
import { prisma } from "../utils/prisma";

const PlanScalarPatchSchema = z
  .object({
    goal: z.string().min(1).optional(),
    goalReason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    outlineType: z.enum(["SPECIFIC", "TIMES_PER_WEEK"]).optional(),
    timesPerWeek: z.number().positive().nullable().optional(),
  })
  .strict();

const SessionPatchSchema = z
  .object({
    id: z.string().optional(),
    activityId: z.string().optional(),
    date: z.string().optional(),
    quantity: z.number().positive().optional(),
    descriptiveGuide: z.string().optional(),
  })
  .strict();

const MilestonePatchSchema = z
  .object({
    id: z.string().optional(),
    description: z.string().min(1).optional(),
    date: z.string().optional(),
    progress: z.number().min(0).max(100).nullable().optional(),
    criteria: z.union([z.string(), z.record(z.string(), z.any())]).nullable().optional(),
  })
  .strict();

export const PlanProposalPatchSchema = z
  .object({
    archive: z.literal(true).optional(),
    plan: PlanScalarPatchSchema.optional(),
    sessions: z
      .object({
        upsert: z.array(SessionPatchSchema).optional(),
        deleteIds: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    milestones: z
      .object({
        upsert: z.array(MilestonePatchSchema).optional(),
        deleteIds: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PlanProposalPatch = z.infer<typeof PlanProposalPatchSchema>;

type PlanForPatch = Plan & {
  activities: Activity[];
  sessions: PlanSession[];
  milestones: PlanMilestone[];
};

export type PlanProposalPatchChange = {
  operation: string;
  entity?: "plan" | "session" | "milestone";
  id?: string;
  success: boolean;
  error?: string;
};

function hasRelationChanges(patch: PlanProposalPatch): boolean {
  return !!(
    patch.sessions?.upsert?.length ||
    patch.sessions?.deleteIds?.length ||
    patch.milestones?.upsert?.length ||
    patch.milestones?.deleteIds?.length
  );
}

function assertArchiveIsStandalone(patch: PlanProposalPatch): void {
  if (patch.archive && (patch.plan || hasRelationChanges(patch))) {
    throw new Error("Archive patch must not include other changes");
  }
}

function parseDateOnly(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }

  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );
}

function getExistingSession(plan: PlanForPatch, sessionId: string): PlanSession {
  const session = plan.sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} does not belong to this plan`);
  }
  return session;
}

function getExistingMilestone(
  plan: PlanForPatch,
  milestoneId: string
): PlanMilestone {
  const milestone = plan.milestones.find((item) => item.id === milestoneId);
  if (!milestone) {
    throw new Error(`Milestone ${milestoneId} does not belong to this plan`);
  }
  return milestone;
}

function ensureActivityBelongsToPlan(plan: PlanForPatch, activityId: string): void {
  if (!plan.activities.some((activity) => activity.id === activityId)) {
    throw new Error(`Activity ${activityId} does not belong to this plan`);
  }
}

function convertLegacyOperationsToPatch(operations: any[]): PlanProposalPatch {
  const patch: PlanProposalPatch = {};

  for (const op of operations) {
    if (op.type === "archive") {
      return { archive: true };
    }

    if (op.type === "update_plan") {
      patch.plan = {
        ...(op.goal !== undefined && { goal: op.goal }),
        ...(op.goalReason !== undefined && { goalReason: op.goalReason }),
        ...(op.notes !== undefined && { notes: op.notes }),
        ...(op.outlineType !== undefined && { outlineType: op.outlineType }),
        ...(op.timesPerWeek !== undefined && { timesPerWeek: op.timesPerWeek }),
      };
      continue;
    }

    if (op.type === "add") {
      patch.sessions = patch.sessions || {};
      patch.sessions.upsert = patch.sessions.upsert || [];
      patch.sessions.upsert.push({
        activityId: op.activityId,
        date: op.date,
        quantity: op.quantity,
        descriptiveGuide: op.descriptiveGuide,
      });
      continue;
    }

    if (op.type === "update") {
      patch.sessions = patch.sessions || {};
      patch.sessions.upsert = patch.sessions.upsert || [];
      patch.sessions.upsert.push({
        id: op.sessionId,
        ...(op.activityId !== undefined && { activityId: op.activityId }),
        ...(op.date !== undefined && { date: op.date }),
        ...(op.quantity !== undefined && { quantity: op.quantity }),
        ...(op.descriptiveGuide !== undefined && {
          descriptiveGuide: op.descriptiveGuide,
        }),
      });
      continue;
    }

    if (op.type === "remove") {
      patch.sessions = patch.sessions || {};
      patch.sessions.deleteIds = patch.sessions.deleteIds || [];
      patch.sessions.deleteIds.push(op.sessionId);
    }
  }

  return patch;
}

export function getProposalPatch(proposal: any): PlanProposalPatch {
  const rawPatch =
    proposal.patch ||
    (Array.isArray(proposal.operations)
      ? convertLegacyOperationsToPatch(proposal.operations)
      : null);

  const parsed = PlanProposalPatchSchema.safeParse(rawPatch);
  if (!parsed.success) {
    throw new Error(
      `Invalid plan proposal patch: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`
    );
  }

  assertArchiveIsStandalone(parsed.data);
  return parsed.data;
}

export async function executePlanProposalPatch(params: {
  planId: string;
  patch: PlanProposalPatch;
  userId?: string;
}): Promise<{ changes: PlanProposalPatchChange[]; plan: PlanForPatch }> {
  const { planId, patch, userId } = params;

  assertArchiveIsStandalone(patch);

  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findFirst({
      where: {
        id: planId,
        deletedAt: null,
        ...(userId ? { userId } : {}),
      },
      include: { activities: true, sessions: true, milestones: true },
    });

    if (!plan) {
      throw new Error("Plan not found");
    }

    const changes: PlanProposalPatchChange[] = [];

    if (patch.archive) {
      await tx.plan.update({
        where: { id: planId },
        data: {
          archivedAt: new Date(),
          coachSuggestedTimesPerWeek: null,
          coachNotes: null,
        },
      });
      changes.push({
        operation: "archive",
        entity: "plan",
        success: true,
      });
      return { changes, plan };
    }

    if (patch.plan) {
      const updateData: Prisma.PlanUpdateInput = {};
      if (patch.plan.goal !== undefined) {
        updateData.goal = patch.plan.goal;
        updateData.goalChanged = true;
      }
      if (patch.plan.goalReason !== undefined) {
        updateData.goalReason = patch.plan.goalReason;
      }
      if (patch.plan.notes !== undefined) {
        updateData.notes = patch.plan.notes;
      }
      if (patch.plan.outlineType !== undefined) {
        updateData.outlineType = patch.plan.outlineType;
      }
      if (patch.plan.timesPerWeek !== undefined) {
        updateData.timesPerWeek = patch.plan.timesPerWeek;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.plan.update({
          where: { id: planId },
          data: updateData,
        });
        changes.push({
          operation: "update",
          entity: "plan",
          id: planId,
          success: true,
        });
      }
    }

    for (const sessionId of patch.sessions?.deleteIds || []) {
      getExistingSession(plan, sessionId);
      await tx.planSession.delete({ where: { id: sessionId } });
      changes.push({
        operation: "delete",
        entity: "session",
        id: sessionId,
        success: true,
      });
    }

    for (const sessionPatch of patch.sessions?.upsert || []) {
      if (sessionPatch.id) {
        getExistingSession(plan, sessionPatch.id);
        const updateData: Prisma.PlanSessionUpdateInput = {};
        if (sessionPatch.activityId !== undefined) {
          ensureActivityBelongsToPlan(plan, sessionPatch.activityId);
          updateData.activity = { connect: { id: sessionPatch.activityId } };
        }
        if (sessionPatch.date !== undefined) {
          updateData.date = parseDateOnly(sessionPatch.date, "session.date");
        }
        if (sessionPatch.quantity !== undefined) {
          updateData.quantity = sessionPatch.quantity;
        }
        if (sessionPatch.descriptiveGuide !== undefined) {
          updateData.descriptiveGuide = sessionPatch.descriptiveGuide;
        }

        await tx.planSession.update({
          where: { id: sessionPatch.id },
          data: updateData,
        });
        changes.push({
          operation: "update",
          entity: "session",
          id: sessionPatch.id,
          success: true,
        });
      } else {
        if (!sessionPatch.activityId || !sessionPatch.date || !sessionPatch.quantity) {
          throw new Error(
            "New sessions require activityId, date, and quantity"
          );
        }
        ensureActivityBelongsToPlan(plan, sessionPatch.activityId);
        const created = await tx.planSession.create({
          data: {
            planId,
            activityId: sessionPatch.activityId,
            date: parseDateOnly(sessionPatch.date, "session.date"),
            quantity: sessionPatch.quantity,
            descriptiveGuide: sessionPatch.descriptiveGuide || "",
            isCoachSuggested: true,
          },
        });
        changes.push({
          operation: "create",
          entity: "session",
          id: created.id,
          success: true,
        });
      }
    }

    for (const milestoneId of patch.milestones?.deleteIds || []) {
      getExistingMilestone(plan, milestoneId);
      await tx.planMilestone.delete({ where: { id: milestoneId } });
      changes.push({
        operation: "delete",
        entity: "milestone",
        id: milestoneId,
        success: true,
      });
    }

    for (const milestonePatch of patch.milestones?.upsert || []) {
      if (milestonePatch.id) {
        getExistingMilestone(plan, milestonePatch.id);
        const updateData: Prisma.PlanMilestoneUpdateInput = {};
        if (milestonePatch.description !== undefined) {
          updateData.description = milestonePatch.description;
        }
        if (milestonePatch.date !== undefined) {
          updateData.date = parseDateOnly(milestonePatch.date, "milestone.date");
        }
        if (milestonePatch.progress !== undefined) {
          updateData.progress = milestonePatch.progress;
        }
        if (milestonePatch.criteria !== undefined) {
          updateData.criteria = milestonePatch.criteria as any;
        }

        await tx.planMilestone.update({
          where: { id: milestonePatch.id },
          data: updateData,
        });
        changes.push({
          operation: "update",
          entity: "milestone",
          id: milestonePatch.id,
          success: true,
        });
      } else {
        if (!milestonePatch.description || !milestonePatch.date) {
          throw new Error("New milestones require description and date");
        }
        const created = await tx.planMilestone.create({
          data: {
            planId,
            description: milestonePatch.description,
            date: parseDateOnly(milestonePatch.date, "milestone.date"),
            progress: milestonePatch.progress ?? 0,
            criteria:
              milestonePatch.criteria === undefined
                ? undefined
                : (milestonePatch.criteria as any),
          },
        });
        changes.push({
          operation: "create",
          entity: "milestone",
          id: created.id,
          success: true,
        });
      }
    }

    return { changes, plan };
  });
}
