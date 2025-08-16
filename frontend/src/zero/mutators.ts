import type { Transaction, UpdateValue } from "@rocicorp/zero";
import type { schema } from "./schema";
import { PlanOutlineType, PlanState } from "./schema";
import { assert } from "@/lib/utils";

export function assertIsLoggedIn(userId: string): asserts userId {
  assert(userId, "userId must be set");
}

type MutatorTx = Transaction<typeof schema>;

// TODO: we're clearly overfetching some stuff, like all activityEntries data for other users
// note to self,
// we are in the midst of making the zero connection dont drop, as we're seeing these errors
// clientID=36a2a6dqjmpncd3imr runLoopCounter=6 Failed to connect {"name":"Error","message":"AbruptClose","stack":"Error: AbruptClose\n    at #onClose (
// logger.ts:185 clientID=va9f2mjl9kem2ut45f wsid=rOxcA0W5X3FLraG8iFc7F Got unexpected socket close event {"code":1006,"reason":"","wasClean":false}
// but before that, you must nail PlanConfigurationForm.tsx
export function createMutators(userId: string) {
  return {
    users: {
      async update(
        tx: MutatorTx,
        data: UpdateValue<typeof schema.tables.users>
      ) {
        assertIsLoggedIn(userId);
        await tx.mutate.users.update(data);
      },
    },

    plans: {
      async clearCoachSuggestedSessions(
        tx: MutatorTx,
        args: {
          planId: string;
        }
      ) {
        assertIsLoggedIn(userId);
        const sessions = await tx.query.plan_sessions.where(
          "planId",
          args.planId
        );
        const coachSessions = sessions.filter(
          (session: any) => session.isCoachSuggested
        );

        for (const session of coachSessions) {
          await tx.mutate.plan_sessions.delete({ id: session.id });
        }
      },

      async upgradeCoachSuggestedSessionsToPlanSessions(
        tx: MutatorTx,
        args: {
          planId: string;
        }
      ) {
        assertIsLoggedIn(userId);
        const sessions = await tx.query.plan_sessions.where(
          "planId",
          args.planId
        );

        const nonCoachSessions = sessions.filter(
          (session: any) => !session.isCoachSuggested
        );
        for (const session of nonCoachSessions) {
          await tx.mutate.plan_sessions.delete({ id: session.id });
        }

        const coachSessions = sessions.filter(
          (session: any) => session.isCoachSuggested
        );
        for (const session of coachSessions) {
          await tx.mutate.plan_sessions.update({
            id: session.id,
            isCoachSuggested: false,
          });
        }
      },
      async upsert(
        tx: MutatorTx,
        args: UpdateValue<typeof schema.tables.plans> & {
          activities: Array<{ id: string }>;
          milestones: Array<{
            description: string;
            date: string;
            criteria: string;
          }>;
          sessions: Array<{
            activityId: string;
            date: string;
            descriptiveGuide: string;
            quantity: number;
          }>;
        }
      ) {
        assertIsLoggedIn(userId);

        if (args.id) {
          // Update existing plan
          const existingPlan = await tx.query.plans.where("id", args.id).one();
          if (!existingPlan || existingPlan.userId !== userId) {
            throw new Error("Not authorized to update this plan");
          }

          await tx.mutate.plans.update({
            id: args.id,
            goal: args.goal,
            emoji: args.emoji,
            finishingDate: args.finishingDate,
            notes: args.notes,
            durationType: args.durationType,
            outlineType: args.outlineType || PlanOutlineType.SPECIFIC,
            timesPerWeek: args.timesPerWeek,
          });

          // Clear existing milestones and sessions
          const existingMilestones = await tx.query.plan_milestones.where(
            "planId",
            args.id
          );
          for (const milestone of existingMilestones) {
            await tx.mutate.plan_milestones.delete({ id: milestone.id });
          }

          const existingSessions = await tx.query.plan_sessions.where(
            "planId",
            args.id
          );
          for (const session of existingSessions) {
            await tx.mutate.plan_sessions.delete({ id: session.id });
          }

          // Create new milestones
          if (args.milestones) {
            for (const milestone of args.milestones) {
              await tx.mutate.plan_milestones.insert({
                id: crypto.randomUUID(),
                planId: args.id,
                description: milestone.description,
                date: new Date(milestone.date).getTime(),
                criteria: milestone.criteria,
                createdAt: Date.now(),
              });
            }
          }

          // Create new sessions
          if (args.sessions) {
            for (const session of args.sessions) {
              await tx.mutate.plan_sessions.insert({
                id: crypto.randomUUID(),
                planId: args.id,
                activityId: session.activityId,
                date: new Date(session.date).getTime(),
                descriptiveGuide: session.descriptiveGuide,
                quantity: session.quantity,
                isCoachSuggested: false,
                createdAt: Date.now(),
              });
            }
          }
        } else {
          // Create new plan
          const planId = crypto.randomUUID();
          const planGroupId = crypto.randomUUID();

          // Create plan group first
          await tx.mutate.plan_groups.insert({
            id: planGroupId,
            createdAt: Date.now(),
          });

          // Create plan
          await tx.mutate.plans.insert({
            id: planId,
            userId: userId,
            planGroupId: planGroupId,
            goal: args.goal || "",
            emoji: args.emoji,
            finishingDate: args.finishingDate,
            notes: args.notes,
            durationType: args.durationType,
            outlineType: args.outlineType || PlanOutlineType.SPECIFIC,
            timesPerWeek: args.timesPerWeek,
            currentWeekState: PlanState.ON_TRACK,
            createdAt: Date.now(),
          });

          // Create milestones
          if (args.milestones) {
            for (const milestone of args.milestones) {
              await tx.mutate.plan_milestones.insert({
                id: crypto.randomUUID(),
                planId: planId,
                description: milestone.description,
                date: new Date(milestone.date).getTime(),
                criteria: milestone.criteria,
                createdAt: Date.now(),
              });
            }
          }

          // Create sessions
          if (args.sessions) {
            for (const session of args.sessions) {
              await tx.mutate.plan_sessions.insert({
                id: crypto.randomUUID(),
                planId: planId,
                activityId: session.activityId,
                date: new Date(session.date).getTime(),
                descriptiveGuide: session.descriptiveGuide,
                quantity: session.quantity,
                isCoachSuggested: false,
                createdAt: Date.now(),
              });
            }
          }
        }
      },
    },

    plan_milestones: {
      async modifyManual(
        tx: MutatorTx,
        args: {
          id: string;
          delta: number;
        }
      ) {
        assertIsLoggedIn(userId);
        const milestone = await tx.query.plan_milestones
          .where("id", args.id)
          .one();
        if (!milestone) throw new Error("Milestone not found");

        const currentProgress = milestone.progress || 0;
        const newProgress = Math.min(
          Math.max(currentProgress + args.delta, 0),
          100
        );

        await tx.mutate.plan_milestones.update({
          id: args.id,
          progress: newProgress,
        });
      },
    },
  };
}

export type Mutators = ReturnType<typeof createMutators>;
