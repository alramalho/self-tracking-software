import type { Photo } from "@/core/types";

export interface SelectedMediaProps {
  media: Photo[];
  disabled: boolean;
  onRemove: (index: number) => void;
}

export interface SelectedMediaTileProps {
  item: Photo;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}

export interface VoiceNoteRecordingProps {
  durationMillis: number;
  onStop: () => void;
  onDiscard: () => void;
}
