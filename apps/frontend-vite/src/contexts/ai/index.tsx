import { useContext } from "react";
import { AIContext } from "./types";

export const useAI = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
};

// Re-exports
export { AIProvider } from "./provider";
export type { Chat, Message } from "./types";
