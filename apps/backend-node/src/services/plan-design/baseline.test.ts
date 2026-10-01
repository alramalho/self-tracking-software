import { describe, expect, it } from "vitest";
import { baselineFromLogs } from "./baseline";

const now = new Date("2026-10-12T10:00:00Z");
const day = (n: number, quantity: number) => ({ datetime: new Date(now.getTime() - n * 86_400_000), quantity });

describe("baselineFromLogs", () => {
  it("summarises the last four weeks from the person's own logs, with numbers", () => {
    const b = baselineFromLogs([day(2, 5), day(6, 4), day(9, 7), day(13, 5), day(20, 5), day(27, 4), day(40, 20)], { title: "Running", measure: "km", now });
    expect(b?.text).toBe("Running: 6 sessions in the last 4 weeks, about 1.5 a week. Typically 5 km, longest 7 km.");
    expect(b?.measurements.map((m) => [m.metric, m.value])).toEqual([["sessions_per_week", 1.5], ["typical_quantity", 5], ["longest_quantity", 7]]);
  });
  it("says nothing when there is too little to go on", () => {
    expect(baselineFromLogs([day(2, 5), day(6, 4)], { title: "Running", measure: "km", now })).toBeNull();
    expect(baselineFromLogs([day(40, 5), day(41, 4), day(42, 5), day(43, 5)], { title: "Running", measure: "km", now })).toBeNull();
  });
});
