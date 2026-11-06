import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { FeedVideoProps } from "./types";

// Loops muted while on screen and pauses off screen; a click toggles sound.
export function FeedVideo({ src, title, className }: FeedVideoProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void element.play().catch(() => {});
        else element.pause();
      },
      { threshold: 0.6 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const Sound = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setMuted(!muted);
      }}
      aria-label={`${muted ? "Unmute" : "Mute"} ${title} video`}
      className={`relative block w-full overflow-hidden bg-black ${className ?? ""}`}
    >
      <video
        ref={video}
        src={src}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 p-1.5 text-white">
        <Sound className="h-4 w-4" />
      </span>
    </button>
  );
}
