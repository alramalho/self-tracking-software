import type { Reaction, Person } from "@/core/types";
export {
  DEFAULT_REACTION_EMOJIS,
  MAX_REACTION_EMOJIS,
  REACTION_EMOJI_CATEGORIES,
  isReactionEmoji,
  normalizeReactionEmojiInput,
  normalizeReactionEmojis,
} from "@tsw/prisma/reactions";

export interface ReactionPickerProps {
  overlay?: boolean;
  disabled?: boolean;
  onSelect: (emoji: string) => Promise<unknown>;
  selectedEmojis?: string[];
}

export interface ReactionAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReactionBadgesProps {
  reactions: Reaction[];
  currentUserId?: string;
  overlay?: boolean;
}
export interface ReactionBadgeProps {
  emoji: string;
  count: number;
  selected: boolean;
  overlay: boolean;
  onOpen: (anchor: ReactionAnchor) => void;
}
export interface ReactionSelection {
  anchor: ReactionAnchor;
  emoji: string;
}
export interface ReactionPeopleProps {
  selection?: ReactionSelection;
  reactions: Reaction[];
  onClose: () => void;
}
export interface ReactionPerson {
  key: string;
  user?: Person;
  emojis: string[];
}
