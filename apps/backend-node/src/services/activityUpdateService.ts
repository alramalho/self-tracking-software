import type { PrismaClient } from "@tsw/prisma";
import { classifyActivityKind } from "./activityCategorizationService";

export type MeasureConversion = {
  operator: "multiply" | "divide";
  factor: number;
};

export async function updateActivityWithMeasureConversion(params: {
  prisma: PrismaClient;
  userId: string;
  activityId: string;
  title: string;
  measure: string;
  emoji: string;
  colorHex?: string | null;
  kind?: string | null;
  measureConversion?: MeasureConversion | null;
}) {
  const {
    prisma,
    userId,
    activityId,
    title,
    measure,
    emoji,
    colorHex,
    measureConversion,
  } = params;
  const kind =
    params.kind || (await classifyActivityKind({ title, measure, emoji }));

  const existingActivity = await prisma.activity.findFirst({
    where: {
      id: activityId,
      userId,
      deletedAt: null,
    },
  });

  if (!existingActivity) {
    return prisma.activity.create({
      data: {
        id: activityId,
        userId,
        title,
        measure,
        emoji,
        colorHex,
        kind,
      },
    });
  }

  const isMeasureChange = existingActivity.measure !== measure;

  if (!isMeasureChange) {
    return prisma.activity.update({
      where: { id: activityId },
      data: {
        userId,
        title,
        measure,
        emoji,
        colorHex,
        kind,
      },
    });
  }

  const operator = measureConversion?.operator;
  const factor = Number(measureConversion?.factor);

  if (
    (operator !== "multiply" && operator !== "divide") ||
    !Number.isInteger(factor) ||
    factor <= 0
  ) {
    throw new Error(
      "Changing an activity measure requires a positive integer conversion factor."
    );
  }

  const activityEntries = await prisma.activityEntry.findMany({
    where: {
      activityId,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      quantity: true,
    },
  });

  const planSessions = await prisma.planSession.findMany({
    where: {
      activityId,
      plan: {
        userId,
        deletedAt: null,
      },
    },
    select: {
      id: true,
      quantity: true,
    },
  });

  const convertQuantity = (quantity: number) =>
    operator === "multiply" ? quantity * factor : quantity / factor;

  const convertedEntries = activityEntries.map((entry) => ({
    id: entry.id,
    quantity: convertQuantity(entry.quantity),
  }));
  const convertedSessions = planSessions.map((session) => ({
    id: session.id,
    quantity: convertQuantity(session.quantity),
  }));
  const fractionalConversion = [...convertedEntries, ...convertedSessions].find(
    (item) => !Number.isInteger(item.quantity)
  );

  if (fractionalConversion) {
    throw new Error(
      "This conversion would create fractional quantities, but activities currently store whole numbers only."
    );
  }

  return prisma.$transaction(async (tx) => {
    const updatedActivity = await tx.activity.update({
      where: { id: activityId },
      data: {
        title,
        measure,
        emoji,
        colorHex,
        kind,
      },
    });

    await Promise.all([
      ...convertedEntries.map((entry) =>
        tx.activityEntry.update({
          where: { id: entry.id },
          data: { quantity: entry.quantity },
        })
      ),
      ...convertedSessions.map((session) =>
        tx.planSession.update({
          where: { id: session.id },
          data: { quantity: session.quantity },
        })
      ),
    ]);

    return updatedActivity;
  });
}
