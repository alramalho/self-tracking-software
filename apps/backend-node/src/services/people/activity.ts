import type { User } from "@tsw/prisma";
import { prisma } from "../../utils/prisma";
import type { PersonWithActivity } from "./types";

export async function addPeopleActivity(
  people: User[],
  database: typeof prisma = prisma,
): Promise<Array<PersonWithActivity<User>>> {
  if (people.length === 0) return [];

  const activity = await database.activityEntry.groupBy({
    by: ["userId"],
    where: {
      userId: { in: people.map((person) => person.id) },
      deletedAt: null,
      activityId: { not: null },
      activity: { deletedAt: null },
    },
    _count: { _all: true },
    _max: { datetime: true },
  });
  const activityByUser = new Map(
    activity.map((entry) => [
      entry.userId,
      {
        activityCount: entry._count._all,
        lastActivityAt: entry._max.datetime,
      },
    ]),
  );

  return people.map((person) => ({
    ...person,
    ...(activityByUser.get(person.id) ?? {
      activityCount: 0,
      lastActivityAt: null,
    }),
  }));
}
