import type { ReactNode } from "react";

export interface FeedAutoplayValue {
  playingCardId?: string;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

export interface FeedAutoplayProviderProps {
  playingCardId?: string;
  children: ReactNode;
}

export interface FeedVideoProps {
  uri: string;
  cardId?: string;
  title: string;
}

export interface VoiceNotePlayerProps {
  uri: string;
  title: string;
  index: number;
}
