"use client";

// Import the consolidated type from the simplified context
import type { PlanProgressData } from "./PlanProgressContext/SimplifiedPlanProgressContext";

// Export the main type for backward compatibility
export type PlanProgress = PlanProgressData;

// Re-export from the simplified context
export { usePlansProgress, usePlanProgress } from "./PlanProgressContext/SimplifiedPlanProgressContext";