import { MessageBubble } from "@/components/MessageBubble";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/contexts/users";
import { useMessages } from "@/contexts/messages";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Send, Loader2, ArrowLeft } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useInView } from "react-intersection-observer";
import ReactMarkdown from "react-markdown";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import { useNavigate } from "@tanstack/react-router";

// Helper to format relative dates for dividers
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return messageDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: messageDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// Helper to check if two dates are on the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Date divider component
function DateDivider({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">{formatRelativeDate(date)}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// Component to track message visibility and mark as read
function MessageWithReadTracking({
  message,
  isOwnMessage,
  onVisible,
  children,
}: {
  message: { id: string; status?: string };
  isOwnMessage: boolean;
  onVisible: (messageId: string) => void;
  children: React.ReactNode;
}) {
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  useEffect(() => {
    if (inView && !isOwnMessage && message.status === "SENT") {
      onVisible(message.id);
    }
  }, [inView, isOwnMessage, message.id, message.status, onVisible]);

  return <div ref={ref}>{children}</div>;
}

export const Route = createFileRoute("/message/$userId")({
  component: MessageUserPage,
});

function MessageUserPage() {
  const { userId } = Route.useParams();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const api = useApiWithAuth();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const {
    chats,
    currentChatId,
    setCurrentChatId,
    messages,
    isLoadingMessages,
    sendMessage,
    isSendingMessage,
    isLoadingChats,
    createDirectChat,
    markMessagesAsRead,
  } = useMessages();

  const [inputValue, setInputValue] = useState("");
  const [otherUser, setOtherUser] = useState<{
    id: string;
    name: string | null;
    username: string | null;
    picture: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debounced mark-as-read tracking
  const messageQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushReadQueue = useCallback(() => {
    if (messageQueueRef.current.size > 0 && currentChatId) {
      const idsToMark = Array.from(messageQueueRef.current);
      markMessagesAsRead(currentChatId, idsToMark);
      messageQueueRef.current.clear();
    }
  }, [currentChatId, markMessagesAsRead]);

  const queueMessageForRead = useCallback(
    (messageId: string) => {
      messageQueueRef.current.add(messageId);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        flushReadQueue();
      }, 2000);
    },
    [flushReadQueue]
  );

  // Cleanup: flush queue on unmount or chat change
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      flushReadQueue();
    };
  }, [flushReadQueue]);

  const currentChat = chats?.find((chat) => chat.id === currentChatId);

  // Load user info and find/create chat
  useEffect(() => {
    if (!userId || isLoadingChats) return;

    const loadUserAndChat = async () => {
      setIsLoadingUser(true);
      setError(null);

      try {
        // First, check if we already have a chat with this user
        const existingChat = chats?.find(chat => {
          if (chat.type !== "DIRECT") return false;
          return chat.participants?.some(p => p.userId === userId);
        });

        if (existingChat) {
          // Get user info from chat participants
          const participant = existingChat.participants?.find(p => p.userId === userId);
          if (participant) {
            setOtherUser({
              id: participant.userId,
              name: participant.name || null,
              username: participant.username || null,
              picture: participant.picture || null,
            });
          }
          setCurrentChatId(existingChat.id);
          setIsLoadingUser(false);
          return;
        }

        // No existing chat - try to create one (this will fail if not friends)
        try {
          const newChat = await createDirectChat(userId);
          if (newChat?.id) {
            const participant = newChat.participants?.find((p: any) => p.userId === userId);
            if (participant) {
              setOtherUser({
                id: participant.userId,
                name: participant.name || null,
                username: participant.username || null,
                picture: participant.picture || null,
              });
            }
            setCurrentChatId(newChat.id);
          }
        } catch (chatError: any) {
          // Chat creation failed - likely not friends
          if (chatError?.response?.status === 403) {
            setError("You can only message users you are connected with");
          } else {
            setError("Could not start conversation with this user");
          }
        }
      } catch (err) {
        console.error("Failed to load user:", err);
        setError("Failed to load conversation");
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUserAndChat();
  }, [userId, chats, isLoadingChats, createDirectChat, setCurrentChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSendingMessage || !currentChatId) {
      return;
    }

    const messageToSend = inputValue;
    setInputValue("");

    try {
      await sendMessage({ message: messageToSend, chatId: currentChatId });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const MarkdownText = ({ children }: { children: string }) => (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span>{children}</span>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        del: ({ children }) => <del className="line-through">{children}</del>,
        ul: ({ children }) => <ul className="list-disc list-inside my-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside my-1">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
        a: ({ href, children }) => <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">{children}</a>,
      }}
    >
      {children}
    </ReactMarkdown>
  );

  // Loading state
  if (isLoadingChats || isLoadingUser) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen bg-background flex-col">
        <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: "/messages" })}
              >
                <ArrowLeft size={20} />
              </Button>
              <h1 className="font-semibold text-foreground">Message</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <p className="text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate({ to: "/messages" })}
            >
              Back to Messages
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = otherUser?.name || otherUser?.username || "Unknown User";
  const initials = otherUser?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="flex h-screen bg-background relative z-50 overflow-hidden">
      <div className="flex-1 flex flex-col w-full max-w-full">
        {/* Header */}
        <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: "/messages" })}
              >
                <ArrowLeft size={20} />
              </Button>
              <Avatar className="w-10 h-10">
                <AvatarImage src={otherUser?.picture || undefined} alt={displayName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-semibold text-foreground">{displayName}</h1>
                {otherUser?.username && (
                  <p className="text-xs text-muted-foreground">@{otherUser.username}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
          <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Send a message to start the conversation
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message: any, index: number) => {
                const isUserMessage = message.role === "USER" || message.senderId === currentUser?.id;
                const isHumanMessage = message.role === "HUMAN";

                const prevMessage = messages[index - 1];
                const messageDate = new Date(message.createdAt);
                const showDateDivider = !prevMessage ||
                  !isSameDay(messageDate, new Date(prevMessage.createdAt));

                return (
                  <MessageWithReadTracking
                    key={message.id}
                    message={message}
                    isOwnMessage={isUserMessage}
                    onVisible={queueMessageForRead}
                  >
                    {showDateDivider && <DateDivider date={messageDate} />}
                    <div
                      className={`flex gap-3 max-w-full overflow-visible ${
                        isUserMessage ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div className="flex flex-col gap-1 max-w-full overflow-visible">
                        <MessageBubble
                          direction={isUserMessage ? "right" : "left"}
                          className={isUserMessage ? "bg-muted" : ""}
                        >
                          <div className="text-sm whitespace-pre-wrap">
                            <MarkdownText>{message.content}</MarkdownText>
                          </div>
                        </MessageBubble>
                      </div>
                    </div>
                  </MessageWithReadTracking>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 pb-4 pt-2">
          <div className="w-full max-w-4xl mx-auto px-4">
            <div className="flex items-center gap-2 bg-muted/80 rounded-full px-3 py-2 border border-border">
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                disabled={isSendingMessage}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSendingMessage}
                className={`p-2 rounded-full transition-colors ${
                  inputValue.trim() && !isSendingMessage
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-muted-foreground/20 text-muted-foreground cursor-not-allowed"
                }`}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessageUserPage;
