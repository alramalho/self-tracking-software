import { ChatMessageComposer, type SendPayload } from "@/components/ChatMessageComposer";
import ImageZoomDialog from "@/components/ImageZoomDialog";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageImageAttachments } from "@/components/MessageImageAttachments";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/contexts/messages";
import type { ZoomedImage } from "@/contexts/messages/types";
import { useCurrentUser } from "@/contexts/users";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

export const Route = createFileRoute("/chat/$chatId")({
  component: ChatPage,
});

// Any chat opened by id, e.g. a circle's group chat: its title, then who said what.
function ChatPage() {
  const { chatId } = Route.useParams();
  const { currentUser } = useCurrentUser();
  const {
    chats,
    setCurrentChatId,
    messages,
    isLoadingMessages,
    sendMessage,
    isSendingMessage,
    markMessagesAsRead,
  } = useMessages();
  const [inputValue, setInputValue] = useState("");
  const [zoomedImage, setZoomedImage] = useState<ZoomedImage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chat = chats?.find((each) => each.id === chatId);
  const title = chat?.title || chat?.planGroupName || "Chat";

  useEffect(() => {
    setCurrentChatId(chatId);
    return () => setCurrentChatId(null);
  }, [chatId, setCurrentChatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    const unread = (messages ?? [])
      .filter((message) => message.senderId !== currentUser?.id && message.status === "SENT")
      .map((message) => message.id);
    if (unread.length) markMessagesAsRead(chatId, unread);
  }, [messages, chatId, currentUser?.id, markMessagesAsRead]);

  const send = async ({ message, imageAttachments }: SendPayload) => {
    if ((!message.trim() && !imageAttachments.length) || isSendingMessage) return;
    try {
      await sendMessage({ message: message.trim(), chatId, imageAttachments });
    } catch (error) {
      toast.error("Failed to send message");
      throw error;
    }
  };

  return (
    <div className="relative z-50 flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex-shrink-0 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => window.history.back()}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="truncate font-semibold text-foreground">{title}</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
          {isLoadingMessages ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !messages?.length ? (
            <div className="py-10 text-center">
              <h3 className="text-lg font-semibold">No messages yet</h3>
              <p className="text-sm text-muted-foreground">Say hi to start the conversation</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMine = message.senderId === currentUser?.id;
              // Name once per run of messages from the same person.
              const showSender = !isMine && messages[index - 1]?.senderId !== message.senderId;
              return (
                <div key={message.id} className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                  {showSender && (
                    <span className="px-2 text-xs text-muted-foreground">{message.senderName || "Someone"}</span>
                  )}
                  <MessageBubble direction={isMine ? "right" : "left"} timestamp={message.createdAt}>
                    <div className="space-y-2 whitespace-pre-wrap text-sm">
                      {message.content?.trim() && <span>{message.content}</span>}
                      <MessageImageAttachments images={message.imageAttachments} onOpen={setZoomedImage} />
                    </div>
                  </MessageBubble>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="flex-shrink-0 pb-4 pt-2">
        <div className="mx-auto w-full max-w-4xl px-4">
          <ChatMessageComposer
            value={inputValue}
            onValueChange={setInputValue}
            onSend={send}
            disabled={isSendingMessage}
            isSending={isSendingMessage}
          />
        </div>
      </div>
      {zoomedImage && (
        <ImageZoomDialog
          open
          onOpenChange={(open) => !open && setZoomedImage(null)}
          src={zoomedImage.src}
          alt={zoomedImage.alt}
        />
      )}
    </div>
  );
}
