import React from "react";
import { Settings2, Smile } from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "@/contexts/users";
import {
  normalizeReactionEmojis,
} from "@tsw/prisma/reactions";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import ReactionEmojiDrawer from "./ReactionEmojiDrawer";

interface ReactionPickerProps {
  show: boolean;
  onToggle: () => void;
  onSelect: (emoji: string) => void;
  variant?: "overlay" | "inline";
}

const ReactionPicker: React.FC<ReactionPickerProps> = ({
  show,
  onToggle,
  onSelect,
  variant = "inline",
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const isOverlay = variant === "overlay";
  const { currentUser } = useCurrentUser();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const reactionEmojis = normalizeReactionEmojis(currentUser?.reactionEmojis);

  if (show) {
    return (
      <>
        <div
          className={`inline-grid w-[284px] max-w-[calc(100vw-1rem)] grid-cols-7 items-center rounded-full border p-[2px] shadow-md ${
            isOverlay
              ? "border-white/40 bg-white/85 backdrop-blur-sm"
              : "border-muted-foreground/20 bg-background"
          }`}
        >
          {reactionEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(emoji);
              }}
              className="flex h-11 w-full min-w-0 items-center justify-center rounded-full bg-transparent text-2xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            aria-label="Customize reaction emojis"
            title="Customize reaction emojis"
            onClick={(event) => {
              event.stopPropagation();
              setCustomizeOpen(true);
            }}
            className={`flex h-11 w-full min-w-0 items-center justify-center rounded-full bg-transparent transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isOverlay ? "text-slate-950" : "text-foreground"
            }`}
          >
            <Settings2 className="h-5 w-5" strokeWidth={2.75} />
          </button>
        </div>
        <ReactionEmojiDrawer
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
        />
      </>
    );
  }

  if (isOverlay) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`inline-flex ${variants.card.glassBg} border border-white/20 backdrop-blur-sm items-center space-x-1 rounded-full p-2 transition-all shadow-md`}
      >
        <Smile className={`h-6 w-6 text-foreground`} />
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-3"
    >
      <Smile className="h-4 w-4" />
      Add reaction
    </button>
  );
};

export default ReactionPicker;
