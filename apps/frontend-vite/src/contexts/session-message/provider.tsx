import React, { useState, useCallback } from "react";
import { SessionMessageContext, type SessionSnapshot, type SessionMessageContextType } from "./types";

export const SessionMessageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pendingSession, setPendingSessionState] = useState<SessionSnapshot | null>(null);

  const setPendingSession = useCallback((session: SessionSnapshot | null) => {
    setPendingSessionState(session);
  }, []);

  const clearPendingSession = useCallback(() => {
    setPendingSessionState(null);
  }, []);

  const context: SessionMessageContextType = {
    pendingSession,
    setPendingSession,
    clearPendingSession,
  };

  return (
    <SessionMessageContext.Provider value={context}>
      {children}
    </SessionMessageContext.Provider>
  );
};
