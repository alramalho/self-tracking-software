import { describe, expect, it, vi } from "vitest";
import { sharedRequest } from "./sharedRequest";

describe("asking for the same design again", () => {
  it("hands over the design already being made instead of starting over", async () => {
    let finish!: (value: string) => void;
    const work = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    const first = sharedRequest("user-a", { goal: "speak Chinese" }, work);
    const retry = sharedRequest("user-a", { goal: "speak Chinese" }, work);
    finish("two routes");
    await expect(first).resolves.toBe("two routes");
    await expect(retry).resolves.toBe("two routes");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("keeps different people and different answers apart", async () => {
    const work = vi.fn(async () => "design");
    await sharedRequest("user-b", { goal: "run 5 km" }, work);
    await sharedRequest("user-c", { goal: "run 5 km" }, work);
    await sharedRequest("user-b", { goal: "run 10 km" }, work);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("tries again after a failed design", async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error("model down")).mockResolvedValueOnce("design");
    await expect(sharedRequest("user-d", { goal: "read" }, work)).rejects.toThrow("model down");
    await expect(sharedRequest("user-d", { goal: "read" }, work)).resolves.toBe("design");
  });
});
