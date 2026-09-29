import { Prisma } from "@tsw/prisma";
import { logger } from "../../utils/logger";
import { notificationService } from "../notificationService";

interface CircleRef {
  id: string;
  name: string;
  emoji: string;
}

// "you and 1 other", "you and 3 others".
export function othersLabel(count: number): string {
  return `you and ${count} ${count === 1 ? "other" : "others"}`;
}

export function circleLabel(circle: CircleRef): string {
  return `${circle.emoji} ${circle.name}`;
}

// Every circle notification opens that circle. `dedupeKey` (per recipient) keeps
// jobs and retries from sending the same news twice.
export async function notifyCircle(
  recipients: string[],
  circle: CircleRef,
  title: string,
  message: string,
  dedupeKey?: string,
): Promise<void> {
  await Promise.all(
    recipients.map(async (userId) => {
      try {
        await notificationService.createAndProcessNotification({
          userId,
          type: "CIRCLE",
          title,
          message,
          relatedId: circle.id,
          relatedData: { url: `/circle/${circle.id}`, circleId: circle.id },
          dedupeKey: dedupeKey ? `${dedupeKey}:${userId}` : undefined,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          return;
        logger.error("Could not send a circle notification", { circleId: circle.id, userId, error });
      }
    }),
  );
}
