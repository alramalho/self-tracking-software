import { ConversationListItem } from "@/components/ConversationListItem";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageFeedback } from "@/components/MessageFeedback";
import { MetricSuggestion } from "@/components/MetricSuggestion";
import { PlanLink } from "@/components/PlanLink";
import { UserRecommendationCards } from "@/components/UserRecommendationCards";
import UserSearch, { type UserSearchResult } from "@/components/UserSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme/useTheme";
import { useAI } from "@/contexts/ai";
import { useCurrentUser } from "@/contexts/users";
import { useMessages, getMessages, type Message } from "@/contexts/messages";
import { createFileRoute } from "@tanstack/react-router";
import { Send, Loader2, MessageCircle, ArrowLeft, Home, Target } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

export const Route = createFileRoute("/messages/")({
  component: MessagesPage,
});

export interface MessagesPageProps {
  targetUsername?: string;
}

export function MessagesPage({ targetUsername }: MessagesPageProps = {}) {
  const { isDarkMode } = useTheme();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const api = useApiWithAuth();
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
    isCreatingDirectChat,
  } = useMessages();
  const {
    submitFeedback,
    isSubmittingFeedback,
    acceptMetric,
    rejectMetric,
    createCoachChat,
    isCreatingCoachChat,
  } = useAI();
  const [inputValue, setInputValue] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for loading older coach conversations
  const [olderCoachMessages, setOlderCoachMessages] = useState<Message[]>([]);
  const [loadedCoachChatIds, setLoadedCoachChatIds] = useState<string[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Track if we've tried to auto-open the target user's chat
  const [hasTriedAutoOpen, setHasTriedAutoOpen] = useState(false);

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  const currentChat = chats?.find((chat) => chat.id === currentChatId);

  // Get all coach chats sorted by date (newest first)
  const coachChats = useMemo(() =>
    chats?.filter(c => c.type === "COACH")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) || []
  , [chats]);

  // Filter chats to show only ONE coach entry and deduplicate direct chats by user
  const displayChats = useMemo(() => {
    const nonCoachChats = chats?.filter(c => c.type !== "COACH") || [];
    const latestCoach = coachChats[0];

    // Deduplicate direct chats - keep only the most recent chat per user
    const seenUserIds = new Set<string>();
    const deduplicatedChats = nonCoachChats
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .filter(chat => {
        if (chat.type !== "DIRECT") return true; // Keep non-direct chats as is

        // For direct chats, find the other participant
        const otherParticipant = chat.participants?.find(p => p.userId !== currentUser?.id);
        if (!otherParticipant?.userId) return true;

        // Skip if we've already seen a chat with this user
        if (seenUserIds.has(otherParticipant.userId)) return false;

        seenUserIds.add(otherParticipant.userId);
        return true;
      });

    // Put coach at the top if it exists
    return latestCoach ? [latestCoach, ...deduplicatedChats] : deduplicatedChats;
  }, [chats, coachChats, currentUser?.id]);

  // Check if there are older coach conversations to load
  const hasOlderConversations = currentChat?.type === "COACH" &&
    loadedCoachChatIds.length < coachChats.length - 1; // -1 because current chat is already shown

  // Merge current messages with older loaded messages for coach chats
  const allMessages = useMemo(() => {
    if (currentChat?.type !== "COACH") {
      return messages || [];
    }
    // Combine older messages with current messages, sort by date
    const combined = [...olderCoachMessages, ...(messages || [])];
    return combined.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [currentChat?.type, messages, olderCoachMessages]);

  // Auto-open conversation with target user if provided
  useEffect(() => {
    // Wait for chats to finish loading before trying to auto-open
    if (!targetUsername || hasTriedAutoOpen || isLoadingChats) return;

    setHasTriedAutoOpen(true);

    // Find existing chat with this user
    const existingChat = chats?.find(chat => {
      if (chat.type !== "DIRECT") return false;
      return chat.participants?.some(p =>
        p.username?.toLowerCase() === targetUsername.toLowerCase()
      );
    });

    if (existingChat) {
      setCurrentChatId(existingChat.id);
    } else {
      // Create a new chat with this user
      // First we need to find the user's ID
      api.get(`/users/get-user-profile/${targetUsername}`)
        .then(response => {
          const user = response.data?.user;
          if (user?.id) {
            return createDirectChat(user.id);
          }
          throw new Error("User not found");
        })
        .then(chat => {
          if (chat?.id) {
            setCurrentChatId(chat.id);
          }
        })
        .catch(error => {
          console.error("Failed to open chat with user:", error);
          toast.error(`Could not start conversation with @${targetUsername}`);
        });
    }
  }, [targetUsername, hasTriedAutoOpen, isLoadingChats, chats, api, createDirectChat, setCurrentChatId]);

  // Load older coach conversation
  const handleLoadOlder = useCallback(async () => {
    if (isLoadingOlder || !currentChat) return;

    // Find the next oldest coach chat that hasn't been loaded
    const loadedIds = new Set([currentChatId, ...loadedCoachChatIds]);
    const nextChat = coachChats.find(c => !loadedIds.has(c.id));

    if (!nextChat) return;

    setIsLoadingOlder(true);
    try {
      const olderMessages = await getMessages(api, nextChat.id);
      setOlderCoachMessages(prev => [...olderMessages, ...prev]);
      setLoadedCoachChatIds(prev => [...prev, nextChat.id]);
    } catch (error) {
      console.error("Failed to load older messages:", error);
      toast.error("Failed to load older conversations");
    } finally {
      setIsLoadingOlder(false);
    }
  }, [api, coachChats, currentChatId, currentChat, isLoadingOlder, loadedCoachChatIds]);

  // Reset older messages state when switching chats
  useEffect(() => {
    setOlderCoachMessages([]);
    setLoadedCoachChatIds([]);
  }, [currentChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStartAIChat = async () => {
    try {
      await createCoachChat({ title: null });
    } catch (error) {
      console.error("Failed to create AI chat:", error);
      toast.error("Failed to start AI chat");
    }
  };

  const handleUserSelect = async (user: UserSearchResult) => {
    try {
      const chat = await createDirectChat(user.userId);
      setCurrentChatId(chat.id);
    } catch (error) {
      console.error("Failed to create direct chat:", error);
      toast.error("Failed to start conversation");
    }
  };

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
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAcceptMetric = async (messageId: string, metricId: string, rating: number) => {
    try {
      await acceptMetric({ messageId });
    } catch (error) {
      console.error("Failed to accept metric:", error);
      throw error;
    }
  };

  const handleRejectMetric = async (messageId: string) => {
    try {
      await rejectMetric(messageId);
    } catch (error) {
      console.error("Failed to reject metric:", error);
      throw error;
    }
  };

  // Helper to render message content with replacements (for coach messages)
  const renderMessageContent = (message: any) => {
    if (message.role !== "COACH") {
      return message.content;
    }

    const content = message.content;
    const parts: (string | JSX.Element)[] = [];
    const replacements: Array<{
      index: number;
      length: number;
      component: JSX.Element;
    }> = [];

    if (message.metricReplacement) {
      const index = content.indexOf(message.metricReplacement.textToReplace);
      if (index !== -1) {
        replacements.push({
          index,
          length: message.metricReplacement.textToReplace.length,
          component: (
            <MetricSuggestion
              key="metric"
              messageId={message.id}
              metricId={message.metricReplacement.metric.id}
              metricTitle={message.metricReplacement.metric.title}
              rating={message.metricReplacement.rating}
              displayText={message.metricReplacement.textToReplace}
              emoji={message.metricReplacement.metric.emoji}
              status={message.metricReplacement.status}
              onAccept={handleAcceptMetric}
              onReject={handleRejectMetric}
            />
          ),
        });
      }
    } else if (message.planReplacements) {
      message.planReplacements.forEach((replacement: any, idx: number) => {
        const index = content.indexOf(replacement.textToReplace);
        if (index !== -1) {
          replacements.push({
            index,
            length: replacement.textToReplace.length,
            component: (
              <PlanLink
                key={`plan-${idx}`}
                planId={replacement.plan.id}
                displayText={replacement.textToReplace}
                emoji={replacement.plan.emoji || undefined}
              />
            ),
          });
        }
      });
    }

    replacements.sort((a, b) => a.index - b.index);

    let lastIndex = 0;
    replacements.forEach((replacement) => {
      if (replacement.index > lastIndex) {
        parts.push(content.substring(lastIndex, replacement.index));
      }
      parts.push(replacement.component);
      lastIndex = replacement.index + replacement.length;
    });

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return (
      <>
        {parts.map((part, idx) =>
          typeof part === "string" ? <span key={idx}>{part}</span> : part
        )}
      </>
    );
  };

  return (
    <div className="flex h-screen bg-background relative z-50 overflow-hidden">
      {!currentChatId ? (
        // Full-screen message history view
        (<div className="flex-1 flex flex-col w-full max-w-full">
          {/* Header */}
          <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
            <div className="px-4 py-3 space-y-3">
              {/* Title row with back button */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate({ to: "/" })}
                >
                  <Home size={18} />
                </Button>
                <h1 className="text-xl font-semibold">Messages</h1>
              </div>

              {/* User Search */}
              <UserSearch onUserClick={handleUserSelect} emptyMessage="No friends found" />
            </div>
          </div>
          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingChats ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Coach Oli - Always at top with distinct styling */}
                <div className="border-b-2 border-primary/20">
                  {coachChats[0] ? (
                    <ConversationListItem
                      chat={coachChats[0]}
                      isActive={false}
                      onClick={() => setCurrentChatId(coachChats[0].id)}
                      currentUserId={currentUser?.id}
                    />
                  ) : (
                    <button
                      onClick={handleStartAIChat}
                      disabled={isCreatingCoachChat}
                      className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={coachIcon} alt="Coach Oli" />
                        <AvatarFallback>CO</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium">Coach Oli</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isCreatingCoachChat ? "Starting chat..." : "Start a conversation with your AI Coach"}
                        </p>
                      </div>
                    </button>
                  )}
                </div>

                {/* Other conversations */}
                {displayChats
                  .filter((chat) => chat.type !== "COACH")
                  .map((chat) => (
                    <ConversationListItem
                      key={chat.id}
                      chat={chat}
                      isActive={false}
                      onClick={() => setCurrentChatId(chat.id)}
                      currentUserId={currentUser?.id}
                    />
                  ))}

                {/* Empty state for no other conversations */}
                {displayChats.filter((chat) => chat.type !== "COACH").length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center p-6 pt-12">
                    <MessageCircle size={32} className="text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Search for someone above to start a conversation
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>)
      ) : (
        // Full-screen chat view
        (<div className="flex-1 flex flex-col w-full max-w-full">
          {/* Chat Header with Back Button */}
          {currentChat && (
            <>
              {currentChat.type === "COACH" ? (
                <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
                  <div className="w-full max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCurrentChatId(null)}
                        >
                          <ArrowLeft size={20} />
                        </Button>
                        <img src={coachIcon} alt="Coach Oli" className="w-10 h-10" />
                        <div>
                          <h1 className="font-semibold text-foreground">Coach Oli</h1>
                          <p className="text-xs text-muted-foreground">AI Coach</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({ to: "/plans" })}
                        className="gap-2"
                      >
                        <Target size={16} />
                        See Plans
                      </Button>
                    </div>
                  </div>
                </div>
              ) : currentChat.type === "DIRECT" ? (
                <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentChatId(null)}
                      >
                        <ArrowLeft size={20} />
                      </Button>
                      {(() => {
                        const otherParticipant = currentChat.participants?.find(
                          (p) => p.userId !== currentUser?.id
                        );
                        const displayName = otherParticipant?.name || otherParticipant?.username || "Unknown User";
                        const initials = otherParticipant?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "?";
                        return (
                          <>
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={otherParticipant?.picture || undefined} alt={displayName} />
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h1 className="font-semibold text-foreground">{displayName}</h1>
                              {otherParticipant?.username && (
                                <p className="text-xs text-muted-foreground">@{otherParticipant.username}</p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentChatId(null)}
                      >
                        <ArrowLeft size={20} />
                      </Button>
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <MessageCircle size={20} className="text-muted-foreground" />
                      </div>
                      <div>
                        <h1 className="font-semibold text-foreground">
                          {currentChat.title || currentChat.planGroupName || "Group Chat"}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                          {currentChat.participants?.length || 0} members
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {/* Messages */}
          <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
            <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-4">
              {/* Load older conversations button for coach chat */}
              {hasOlderConversations && (
                <button
                  onClick={handleLoadOlder}
                  disabled={isLoadingOlder}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isLoadingOlder ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Load older conversations"
                  )}
                </button>
              )}

              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : allMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">No messages yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Send a message to start the conversation
                    </p>
                  </div>
                </div>
              ) : (
                allMessages.map((message: any, index: number) => {
                  const isUserMessage = message.role === "USER" || message.senderId === currentUser?.id;
                  const isCoachMessage = message.role === "COACH";
                  const isHumanMessage = message.role === "HUMAN";

                  // Check if we need a date divider
                  const prevMessage = allMessages[index - 1];
                  const messageDate = new Date(message.createdAt);
                  const showDateDivider = !prevMessage ||
                    !isSameDay(messageDate, new Date(prevMessage.createdAt));

                  return (
                    <div key={message.id}>
                      {showDateDivider && <DateDivider date={messageDate} />}
                      <div
                        className={`flex gap-3 max-w-full overflow-visible ${
                          isUserMessage ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <div className="flex flex-col gap-1 max-w-full overflow-visible">
                          <MessageBubble
                            direction={isUserMessage ? "right" : "left"}
                            className={
                              isUserMessage
                                ? `bg-muted`
                                : isHumanMessage ? "" : "bg-transparent pl-0"
                            }
                          >
                            <div className="text-sm whitespace-pre-wrap">
                              {renderMessageContent(message)}
                            </div>
                          </MessageBubble>

                          {isCoachMessage && message.userRecommendations && (
                            <UserRecommendationCards
                              recommendations={message.userRecommendations}
                            />
                          )}

                          {isCoachMessage && (
                            <MessageFeedback
                              messageId={message.id}
                              existingFeedback={
                                message.feedback && message.feedback.length > 0
                                  ? message.feedback[0]
                                  : null
                              }
                              onSubmitFeedback={async (data) => {
                                await submitFeedback(data);
                              }}
                              isSubmitting={isSubmittingFeedback}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {/* Typing indicator - only for coach chats */}
              {isSendingMessage && currentChat?.type === "COACH" && (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-muted-foreground/50 animate-pulse" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {/* Input - ChatGPT style */}
          <div className="flex-shrink-0 pb-4 pt-2">
            <div className="w-full max-w-4xl mx-auto px-4">
              <div className="flex items-center gap-3 bg-muted/80 rounded-full px-4 py-2 border border-border">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    currentChat?.type === "COACH"
                      ? "Ask anything"
                      : "Type a message..."
                  }
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
        </div>)
      )}
    </div>
  )
}

export default MessagesPage;
