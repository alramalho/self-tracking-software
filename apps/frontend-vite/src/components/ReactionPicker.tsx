import React from "react";
import { ReactionBarSelector } from "@charkour/react-reactions";
import { Smile } from "lucide-react";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";

const REACTION_EMOJI_MAPPING = {
  fire: "🔥",
  rocket: "🚀",
  love: "♥️",
  laugh: "😂",
  oof: "😮‍💨",
  peach: "🍑",
  surprise: "😮",
};

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

  const handleSelect = (key: any) => {
    const emoji =
      REACTION_EMOJI_MAPPING[key as keyof typeof REACTION_EMOJI_MAPPING];
    onSelect(emoji);
  };

  if (show) {
    return (
      <ReactionBarSelector
        iconSize={24}
        style={{
          border: `1px solid ${
            isOverlay ? "rgba(255, 255, 255, 0.2)" : "rgba(128, 128, 128, 0.2)"
          }`,
          ...(isOverlay && {
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            zIndex: 40,
          }),
        }}
        reactions={Object.entries(REACTION_EMOJI_MAPPING).map(
          ([key, value]) => ({
            label: key,
            node: <div>{value}</div>,
            key,
          })
        )}
        onSelect={handleSelect}
      />
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
