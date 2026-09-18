import { useCallback, useEffect, useState } from "react";
import { readPendingVoiceLog, clearPendingVoiceLog, writePendingVoiceLog } from "./storage";
import type { VoiceLogDraft } from "./types";

export function usePendingVoiceLog() {
  const [draft, setDraft] = useState<VoiceLogDraft | null | undefined>();
  useEffect(() => {
    let active = true;
    void readPendingVoiceLog()
      .then((value) => {
        if (active) setDraft(value);
      })
      .catch(() => {
        if (active) setDraft(null);
      });
    return () => {
      active = false;
    };
  }, []);
  const persist = useCallback(async (value: VoiceLogDraft) => {
    await writePendingVoiceLog(value);
    setDraft(value);
  }, []);
  const clear = useCallback(async () => {
    await clearPendingVoiceLog();
    setDraft(null);
  }, []);
  const sync = useCallback((value: VoiceLogDraft | null) => {
    setDraft(value);
  }, []);
  return { draft, persist, clear, sync };
}
