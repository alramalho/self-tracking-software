import { useCallback, useEffect, useState } from "react";
import { readPendingVoiceLog, clearPendingVoiceLog, writePendingVoiceLog } from "./storage";
import type { VoiceLogDraft } from "./types";

// Home and Add each use this hook; share changes so a note left on one
// screen shows (or disappears) on the other straight away.
type Listener = (value: VoiceLogDraft | null) => void;
const listeners = new Set<Listener>();
function broadcast(value: VoiceLogDraft | null) {
  for (const listener of listeners) listener(value);
}

export function usePendingVoiceLog() {
  const [draft, setDraft] = useState<VoiceLogDraft | null | undefined>();
  useEffect(() => {
    let active = true;
    const listener: Listener = (value) => setDraft(value);
    listeners.add(listener);
    void readPendingVoiceLog()
      .then((value) => {
        if (active) setDraft((current) => (current === undefined ? value : current));
      })
      .catch(() => {
        if (active) setDraft((current) => (current === undefined ? null : current));
      });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);
  const persist = useCallback(async (value: VoiceLogDraft) => {
    await writePendingVoiceLog(value);
    broadcast(value);
  }, []);
  const clear = useCallback(async () => {
    await clearPendingVoiceLog();
    broadcast(null);
  }, []);
  const sync = useCallback((value: VoiceLogDraft | null) => {
    broadcast(value);
  }, []);
  return { draft, persist, clear, sync };
}
