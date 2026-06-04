import { useContext } from "react";
import { MessagesContext } from "./types";

export { MessagesProvider } from "./provider";
export { getMessages } from "./service";
export type {
  Chat,
  ImageAttachment,
  Message,
  ChatType,
  ChatParticipant,
  MessagesContextType,
  UserAction,
  UserActionDiff,
} from "./types";

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error("useMessages must be used within a MessagesProvider");
  }
  return context;
};
