import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ messages: [] as { id: string; metadata: any }[] }));
vi.mock("../utils/prisma", () => ({
  prisma: {
    message: {
      findMany: async ({ where }: any) =>
        store.messages.filter((m) => !where.id?.notIn?.includes(m.id)),
      update: async ({ where, data }: any) => {
        store.messages.find((m) => m.id === where.id)!.metadata = data.metadata;
      },
    },
  },
}));

import { settleOpenPlanChanges } from "./planChangeStatusService";

const card = (planId: string, status: string | null = null) => ({ planId, description: "x", patch: {}, status });

describe("settleOpenPlanChanges", () => {
  beforeEach(() => {
    store.messages = [
      { id: "old", metadata: { planProposals: [card("chinese"), card("gym", "accepted")] } },
      { id: "other", metadata: { planProposals: [card("run")] } },
      { id: "new", metadata: { planProposals: [card("chinese")] } },
    ];
  });

  it("replaces the waiting card for the same plan and leaves answered and newer ones alone", async () => {
    expect(await settleOpenPlanChanges("chat", { replaced: ["chinese", "gym"] }, ["new"])).toBe(1);
    const old = store.messages[0].metadata.planProposals;
    expect(old[0].status).toBe("replaced");
    expect(old[1].status).toBe("accepted");
    expect(store.messages[1].metadata.planProposals[0].status).toBeNull();
    expect(store.messages[2].metadata.planProposals[0].status).toBeNull();
  });

  it("withdraws a card the coach took back", async () => {
    await settleOpenPlanChanges("chat", { withdrawn: ["run"] });
    expect(store.messages[1].metadata.planProposals[0].status).toBe("withdrawn");
  });
});
