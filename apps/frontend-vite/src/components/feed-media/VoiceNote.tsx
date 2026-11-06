import type { VoiceNoteProps } from "./types";

export function VoiceNote({ src, title }: VoiceNoteProps) {
  return (
    <audio
      controls
      preload="metadata"
      src={src}
      aria-label={`${title} voice note`}
      className="w-full h-10"
      onClick={(event) => event.stopPropagation()}
    />
  );
}
