import { useContext } from "react";
import { PlanCreationContext } from "./types";

export const usePlanCreation = () => {
  const context = useContext(PlanCreationContext);
  if (!context) {
    throw new Error("usePlanCreation must be used within a PlanCreationProvider");
  }
  return context;
};
