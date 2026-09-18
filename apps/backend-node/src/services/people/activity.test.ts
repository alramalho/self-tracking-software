import type { User } from "@tsw/prisma";
import { expect, it, vi } from "vitest";
import { prisma } from "../../utils/prisma";
import { addPeopleActivity } from "./activity";

it("counts only non-deleted activity and gives inactive people zeroes", async () => {
  const database = {
    activityEntry: {
      groupBy: vi.fn().mockResolvedValue([
        {
          userId: "active",
          _count: { _all: 7 },
          _max: { datetime: new Date("2026-09-15T08:00:00Z") },
        },
      ]),
    },
  };
  const people = [
    { id: "active", username: "active" },
    { id: "quiet", username: "quiet" },
  ] as User[];

  const result = await addPeopleActivity(
    people,
    database as unknown as typeof prisma,
  );

  expect(database.activityEntry.groupBy).toHaveBeenCalledWith({
    by: ["userId"],
    where: {
      userId: { in: ["active", "quiet"] },
      deletedAt: null,
      activityId: { not: null },
      activity: { deletedAt: null },
    },
    _count: { _all: true },
    _max: { datetime: true },
  });
  expect(result).toEqual([
    {
      ...people[0],
      activityCount: 7,
      lastActivityAt: new Date("2026-09-15T08:00:00Z"),
    },
    { ...people[1], activityCount: 0, lastActivityAt: null },
  ]);
});
