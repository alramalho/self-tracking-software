import { Prisma } from "@tsw/prisma";
import type { FollowThroughState } from "@tsw/prisma/follow-through";
import { prisma } from "../../utils/prisma";
import { initialState } from "./model";

export async function changeState<T>(
  userId: string,
  change: (
    state: FollowThroughState,
    tx: Prisma.TransactionClient,
  ) => Promise<T>,
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const row = await tx.coachingState.upsert({
            where: { userId },
            create: {
              userId,
              data: initialState() as unknown as Prisma.InputJsonValue,
            },
            update: {},
          });
          await tx.$queryRaw`SELECT "userId" FROM "coaching_state" WHERE "userId" = ${userId} FOR UPDATE`;
          const fresh = await tx.coachingState.findUniqueOrThrow({
            where: { userId },
          });
          const state = fresh.data as unknown as FollowThroughState;
          const result = await change(state, tx);
          await tx.coachingState.update({
            where: { userId },
            data: {
              data: state as unknown as Prisma.InputJsonValue,
              revision: { increment: 1 },
            },
          });
          return result;
        },
        {
          // The user row is locked above; ReadCommitted lets unrelated accounts progress independently.
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        attempt < 5 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")
      ) {
        // A first onboarding save can race with the initial state row creation,
        // and several mobile retries can arrive together after a slow response.
        // Back off between retries so they do not immediately collide again.
        await new Promise((resolve) =>
          setTimeout(resolve, 75 * 2 ** attempt + Math.random() * 75),
        );
        continue;
      }
      throw error;
    }
  }
  throw new Error("Could not save changes. Please retry.");
}

export const planInclude = { activities: true, sessions: true } as const;
export async function ownedPlans(
  userId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.plan.findMany({
    where: { userId, deletedAt: null, archivedAt: null },
    include: planInclude,
  });
}

export async function recentEntries(
  userId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.activityEntry.findMany({
    where: {
      userId,
      deletedAt: null,
      datetime: { gte: new Date(Date.now() - 45 * 86400000) },
    },
    select: { id: true, activityId: true, datetime: true, deletedAt: true },
  });
}
