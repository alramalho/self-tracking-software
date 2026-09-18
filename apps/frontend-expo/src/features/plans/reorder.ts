import type { Plan } from "@/core/types";
// Hidden (expired/archived) plans retain their slots, as in the Vite renderer.
export function reorderVisiblePlans(
  all: Plan[],
  visible: Plan[],
  id: string,
  targetIndex: number,
) {
  const from = visible.findIndex((plan) => plan.id === id);
  if (
    from < 0 ||
    targetIndex < 0 ||
    targetIndex >= visible.length ||
    from === targetIndex
  )
    return all;
  const queue = [...visible];
  queue.splice(targetIndex, 0, queue.splice(from, 1)[0]);
  const visibleIds = new Set(visible.map((plan) => plan.id));
  let index = 0;
  return all
    .map((plan) => (visibleIds.has(plan.id) ? queue[index++] : plan))
    .map((plan, sortOrder) => ({ ...plan, sortOrder }));
}
