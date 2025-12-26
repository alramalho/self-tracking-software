import { useContext } from "react";
import { SessionMessageContext } from "./types";

export { SessionMessageProvider } from "./provider";
export type { SessionSnapshot, SessionMessageContextType } from "./types";

export const useSessionMessage = () => {
  const context = useContext(SessionMessageContext);
  if (context === undefined) {
    throw new Error("useSessionMessage must be used within a SessionMessageProvider");
  }
  return context;
};
