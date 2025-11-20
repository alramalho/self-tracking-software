import React from "react";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";

interface ReactionCount {
  [key: string]: string[];
}

interface ReactionsListProps {
  reactions: ReactionCount;
  currentUsername?: string;
  onReactionClick: (emoji: string) => void;
  variant?: "overlay" | "inline";
}

const ReactionsList: React.FC<ReactionsListProps> = ({
  reactions,
  currentUsername,
  onReactionClick,
  variant = "inline",
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  if (!reactions || Object.keys(reactions).length === 0) {
    return null;
  }

  const isOverlay = variant === "overlay";

  return (
    <div
      className={`flex ${isOverlay ? "flex-col" : "flex-wrap"} ${
        isOverlay ? "flex-nowrap items-start" : ""
      } gap-2 ${isOverlay ? "" : "mb-3"}`}
    >
      {Object.entries(reactions).map(([emoji, usernames]) => {
        const isSelected = usernames.includes(currentUsername || "");

        return (
          <button
            key={emoji}
            onClick={() => onReactionClick(emoji)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm shadow-md transition-all gap-2 ${
              isOverlay
                ? `border border-white/20 backdrop-blur-sm ${
                    isSelected
                      ? variants.card.selected.glassBg
                      : variants.card.glassBg
                  }`
                : isSelected
                ? variants.card.selected.bg
                : variants.card.selected.glassBg
            }`}
          >
            <span className="text-base">{emoji}</span>
            <span className="text-foreground font-medium">
              {usernames.length}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ReactionsList;
