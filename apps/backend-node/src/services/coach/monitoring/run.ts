import type { MonitoringRunPorts } from "./types";

/** The same top-level operation is exercised by the scheduler and scenario tests. */
export async function runMonitoring(ports: MonitoringRunPorts) {
  const decision = await ports.claim();
  if (!decision) return "quiet";
  try {
    const response = await ports.generate(decision);
    return (await ports.commit(decision, response)) ? "delivered" : "discarded";
  } finally {
    await ports.release(decision);
  }
}
