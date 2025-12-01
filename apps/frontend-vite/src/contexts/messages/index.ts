import { useContext } from "react";
import { MessagesContext } from "./types";

export { MessagesProvider } from "./provider";
export { getMessages } from "./service";
export type { Chat, Message, ChatType, ChatParticipant, MessagesContextType } from "./types";

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error("useMessages must be used within a MessagesProvider");
  }
  return context;
};
