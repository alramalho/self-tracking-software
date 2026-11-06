import { createContext, useContext, useMemo, useState } from "react";
import type { FeedAutoplayValue, FeedAutoplayProviderProps } from "./types";

const FeedAutoplay = createContext<FeedAutoplayValue | undefined>(undefined);

// One feed video plays at a time: the first visible card that has one. Videos
// start muted; unmuting one keeps sound on for the next, like Instagram.
export function FeedAutoplayProvider({ playingCardId, children }: FeedAutoplayProviderProps) {
  const [muted, setMuted] = useState(true);
  const value = useMemo(
    () => ({ playingCardId, muted, setMuted }),
    [playingCardId, muted],
  );
  return <FeedAutoplay.Provider value={value}>{children}</FeedAutoplay.Provider>;
}

export function useFeedAutoplay() {
  return useContext(FeedAutoplay);
}
