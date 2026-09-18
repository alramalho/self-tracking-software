import type { RefObject } from "react";
import type { TextInput } from "react-native-gesture-handler";
import type { Comment, Person } from "@/core/types";

export interface CommentsSheetProps {
  visible: boolean;
  base: string;
  comments: Comment[];
  loading: boolean;
  error: Error | null;
  retry: () => void;
  onClose: () => void;
}
export interface ComposerContextValue {
  text: string;
  setText: (text: string) => void;
  input: RefObject<TextInput | null>;
  user?: Person;
  pending: boolean;
  error: Error | null;
  send: () => void;
  replyTo?: string;
  cancelReply: () => void;
}
export interface CommentAvatarProps {
  person?: Partial<Person>;
  size?: number;
}
