import { ChatHeader } from "@/components/ChatHeader";
import { ConversationListItem } from "@/components/ConversationListItem";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageFeedback } from "@/components/MessageFeedback";
import { MetricSuggestion } from "@/components/MetricSuggestion";
import { PlanLink } from "@/components/PlanLink";
import { UserRecommendationCards } from "@/components/UserRecommendationCards";
import UserSearch, { UserSearchResult } from "@/components/UserSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/theme/useTheme";
import { useAI } from "@/contexts/ai";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { createFileRoute } from "@tanstack/react-router";
import { Send, Loader2, MessageCircle, ArrowLeft, Bot, Home, Target } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createDirectChat } from "@/contexts/ai/service";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dms")({
  component: DirectMessagesPage,
});

function DirectMessagesPage() {
  const { isDarkMode } = useTheme();
  const themeColors = useThemeColors();
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
    submitFeedback,
    isSubmittingFeedback,
    acceptMetric,
    rejectMetric,
    isLoadingChats,
    createChat,
    isCreatingChat,
  } = useAI();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  const currentChat = chats?.find((chat) => chat.id === currentChatId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStartAIChat = async () => {
    try {
      await createChat({ title: null });
    } catch (error) {
      console.error("Failed to create AI chat:", error);
      toast.error("Failed to start AI chat");
    }
  };

  const handleUserSelect = async (user: UserSearchResult) => {
    try {
      const chat = await createDirectChat(api, user.userId);
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
        <div className="flex-1 flex flex-col w-full max-w-full">
          {/* Header */}
          <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
            <div className="px-4 py-3">
              {/* Back to Home Button */}
              <Button
                variant="ghost"
                onClick={() => navigate({ to: "/" })}
                className="gap-2 mb-4"
              >
                <Home size={18} />
                Back to Home
              </Button>

              <h1 className="text-xl font-semibold mb-0">Messages</h1>

              {/* User Search */}
              <div className="mb-4">
                <UserSearch onUserClick={handleUserSelect} />
              </div>

              {/* Start AI Chat Button */}
              <Button
                onClick={handleStartAIChat}
                disabled={isCreatingChat}
                className={`w-full ${themeColors.button.solid} gap-2 mb-2`}
              >
                {isCreatingChat ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Bot size={20} />
                    Chat with AI Coach
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingChats ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !chats || chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <MessageCircle size={48} className="text-muted-foreground mb-3 opacity-50" />
                <h3 className="font-semibold text-lg mb-1">No conversations yet</h3>
                <p className="text-sm text-muted-foreground">
                  Search for someone above or start a chat with your AI Coach
                </p>
              </div>
            ) : (
              chats.map((chat) => (
                <ConversationListItem
                  key={chat.id}
                  chat={chat}
                  isActive={false}
                  onClick={() => setCurrentChatId(chat.id)}
                  currentUserId={currentUser?.id}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        // Full-screen chat view
        <div className="flex-1 flex flex-col w-full max-w-full">
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
            <div className="flex-1 overflow-y-auto">
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
                  messages.map((message: any) => {
                    const isUserMessage = message.role === "USER" || message.senderId === currentUser?.id;
                    const isCoachMessage = message.role === "COACH";

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 max-w-full overflow-visible ${
                          isUserMessage ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Avatar for non-user messages */}
                        {!isUserMessage && (
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            {isCoachMessage ? (
                              <>
                                <AvatarImage src={coachIcon} alt="Coach Oli" />
                                <AvatarFallback>CO</AvatarFallback>
                              </>
                            ) : (
                              <>
                                <AvatarImage
                                  src={message.senderPicture || undefined}
                                  alt={message.senderName || "User"}
                                />
                                <AvatarFallback>
                                  {message.senderName?.[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </>
                            )}
                          </Avatar>
                        )}

                        <div className="flex flex-col gap-1 max-w-full overflow-visible">
                          <MessageBubble
                            direction={isUserMessage ? "right" : "left"}
                            className={
                              isUserMessage
                                ? `bg-muted`
                                : "bg-transparent px-1"
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
                    );
                  })
                )}
                {isSendingMessage && (
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      {currentChat?.type === "COACH" ? (
                        <>
                          <AvatarImage src={coachIcon} alt="Coach Oli" />
                          <AvatarFallback>CO</AvatarFallback>
                        </>
                      ) : (
                        <AvatarFallback>...</AvatarFallback>
                      )}
                    </Avatar>
                    <MessageBubble direction="left" className="bg-muted">
                      <div className="flex gap-1">
                        <span
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </MessageBubble>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

          {/* Input */}
          <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-t border-border">
            <div className="w-full max-w-4xl mx-auto px-4 py-4">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    currentChat?.type === "COACH"
                      ? "Ask about your plans, goals, or get advice..."
                      : "Type a message..."
                  }
                  className="flex-1"
                  disabled={isSendingMessage}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSendingMessage}
                  className={themeColors.button.solid}
                >
                  <Send size={18} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DirectMessagesPage;
