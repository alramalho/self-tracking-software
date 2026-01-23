import { CoachToolCallsCard } from "@/components/CoachToolCallsCard";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageFeedback } from "@/components/MessageFeedback";
import { MetricSuggestion } from "@/components/MetricSuggestion";
import { PlanLink } from "@/components/PlanLink";
import { UserRecommendationCards } from "@/components/UserRecommendationCards";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme/useTheme";
import { useAI } from "@/contexts/ai";
import { useCurrentUser } from "@/contexts/users";
import { useMessages, getMessages, type Message } from "@/contexts/messages";
import { usePlans } from "@/contexts/plans";
import { useSessionMessage } from "@/contexts/session-message";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Send, Loader2, ArrowLeft, Target, X, MoreVertical, Plus, Settings } from "lucide-react";
import { format } from "date-fns";
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

// WhatsApp-style formatted input preview with visible markers
function FormattedInputPreview({ text }: { text: string }) {
  if (!text) return null;

  const hasFormatting = /[*_~]/.test(text) || /^[\s]*[-*]\s/m.test(text) || /^[\s]*\d+\.\s/m.test(text);
  if (!hasFormatting) return null;

  const renderFormattedText = (input: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    const lines = input.split('\n');

    lines.forEach((line: string, lineIdx: number) => {
      if (lineIdx > 0) {
        result.push(<br key={`br-${lineIdx}`} />);
      }

      const bulletMatch = line.match(/^([\s]*)([-*])(\s)(.*)$/);
      if (bulletMatch) {
        const [, indent, bullet, space, content] = bulletMatch;
        result.push(
          <span key={`line-${lineIdx}`}>
            {indent}
            <span className="opacity-50">{bullet}</span>
            {space}
            {renderInlineFormatting(content, `${lineIdx}-`)}
          </span>
        );
        return;
      }

      const numberedMatch = line.match(/^([\s]*)(\d+)(\.)(\s)(.*)$/);
      if (numberedMatch) {
        const [, indent, num, dot, space, content] = numberedMatch;
        result.push(
          <span key={`line-${lineIdx}`}>
            {indent}
            <span className="opacity-50">{num}{dot}</span>
            {space}
            {renderInlineFormatting(content, `${lineIdx}-`)}
          </span>
        );
        return;
      }

      result.push(<span key={`line-${lineIdx}`}>{renderInlineFormatting(line, `${lineIdx}-`)}</span>);
    });

    return result;
  };

  const renderInlineFormatting = (text: string, keyPrefix: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    const regex = /(\*([^*]+)\*)|(_([^_]+)_)|(~([^~]+)~)/g;
    let lastIndex = 0;
    let match;
    let idx = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(<span key={`${keyPrefix}text-${idx++}`}>{text.slice(lastIndex, match.index)}</span>);
      }

      if (match[1]) {
        result.push(
          <span key={`${keyPrefix}bold-${idx++}`}>
            <span className="opacity-40">*</span>
            <strong className="font-semibold">{match[2]}</strong>
            <span className="opacity-40">*</span>
          </span>
        );
      } else if (match[3]) {
        result.push(
          <span key={`${keyPrefix}italic-${idx++}`}>
            <span className="opacity-40">_</span>
            <em>{match[4]}</em>
            <span className="opacity-40">_</span>
          </span>
        );
      } else if (match[5]) {
        result.push(
          <span key={`${keyPrefix}strike-${idx++}`}>
            <span className="opacity-40">~</span>
            <del className="line-through">{match[6]}</del>
            <span className="opacity-40">~</span>
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      result.push(<span key={`${keyPrefix}text-end`}>{text.slice(lastIndex)}</span>);
    }

    return result.length > 0 ? result : [<span key={`${keyPrefix}empty`}>{text}</span>];
  };

  return (
    <div className="text-foreground whitespace-pre-wrap">
      {renderFormattedText(text)}
    </div>
  );
}

export const Route = createFileRoute("/message-ai")({
  component: MessageAIPage,
});

function MessageAIPage() {
  const { isDarkMode } = useTheme();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const api = useApiWithAuth();
  const { plans } = usePlans();
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
  } = useMessages();
  const {
    submitFeedback,
    isSubmittingFeedback,
    acceptMetric,
    rejectMetric,
    createCoachChat,
    isCreatingCoachChat,
  } = useAI();
  const { pendingSession, clearPendingSession } = useSessionMessage();
  const [inputValue, setInputValue] = useState("");
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [olderCoachMessages, setOlderCoachMessages] = useState<Message[]>([]);
  const [loadedCoachChatIds, setLoadedCoachChatIds] = useState<string[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  // Get all coach chats sorted by date (newest first)
  const coachChats = useMemo(() =>
    chats?.filter(c => c.type === "COACH")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) || []
    , [chats]);

  const currentChat = chats?.find((chat) => chat.id === currentChatId);

  // Auto-select most recent coach chat or create one
  useEffect(() => {
    if (isLoadingChats) return;

    if (coachChats.length > 0 && !currentChatId) {
      setCurrentChatId(coachChats[0].id);
    } else if (coachChats.length === 0 && !isCreatingCoachChat) {
      createCoachChat({ title: null });
    }
  }, [coachChats, currentChatId, isLoadingChats, isCreatingCoachChat, setCurrentChatId, createCoachChat]);

  // Check if there are older coach conversations to load
  const hasOlderConversations = currentChat?.type === "COACH" &&
    loadedCoachChatIds.length < coachChats.length - 1;

  // Merge current messages with older loaded messages
  const allMessages = useMemo(() => {
    const combined = [...olderCoachMessages, ...(messages || [])];
    return combined.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages, olderCoachMessages]);

  // Load older coach conversation
  const handleLoadOlder = useCallback(async () => {
    if (isLoadingOlder || !currentChat) return;

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

  // Close chat menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setShowChatMenu(false);
      }
    };
    if (showChatMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showChatMenu]);

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

    let messageToSend = inputValue;
    if (pendingSession) {
      const sessionDate = format(new Date(pendingSession.date), "EEEE, MMM d");
      const description = pendingSession.descriptiveGuide ? `|${pendingSession.descriptiveGuide}` : "";
      const sessionInfo = `[About: ${pendingSession.activityEmoji || "📋"} ${pendingSession.activityTitle} on ${sessionDate}${pendingSession.quantity ? ` (${pendingSession.quantity} ${pendingSession.activityMeasure})` : ""}${description}]\n\n`;
      messageToSend = sessionInfo + inputValue;
      clearPendingSession();
    }

    setInputValue("");

    try {
      await sendMessage({ message: messageToSend, chatId: currentChatId, coachVersion: "v2" });
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

  // Session info card component
  const SessionInfoCard = ({ sessionText }: { sessionText: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const match = sessionText.match(/\[About: (.+?) (.+?) on ([^(|]+?)(?:\s*\((.+?)\))?(?:\|(.+?))?\]/);
    if (!match) return null;

    const [, emoji, title, date, quantityInfo, description] = match;
    const isLong = description && description.length > 80;
    const isClickable = isLong || description;

    return (
      <div
        className={cn(
          "flex gap-2 pl-3 py-1 mb-2 border-l-2",
          variants.brightBorder,
          isClickable && "cursor-pointer"
        )}
        onClick={() => isClickable && setIsExpanded(!isExpanded)}
      >
        <span className="text-base">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-medium text-foreground/80">{title}</span>
            <span className="text-xs text-muted-foreground/70">• {date.trim()}</span>
            {quantityInfo && (
              <span className="text-xs text-muted-foreground/70">• {quantityInfo}</span>
            )}
          </div>
          {description && (
            <div className="mt-0.5">
              <p className={cn("text-xs text-muted-foreground/60", !isExpanded && isLong && "line-clamp-1")}>
                {description}
              </p>
              {isLong && (
                <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/50">
                  {isExpanded ? "Show less" : "Read more"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSessionInfoCard = (sessionText: string) => {
    return <SessionInfoCard sessionText={sessionText} />;
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

  const renderMessageContent = (message: any) => {
    const content = message.content;
    const sessionPattern = /\[About: .+?\]\n\n/;
    const sessionMatch = content.match(sessionPattern);

    if (sessionMatch) {
      const sessionCard = renderSessionInfoCard(sessionMatch[0]);
      const restOfMessage = content.replace(sessionPattern, '');

      return (
        <>
          {sessionCard}
          {message.role === "COACH" ? renderCoachContent({ ...message, content: restOfMessage }) : <MarkdownText>{restOfMessage}</MarkdownText>}
        </>
      );
    }

    if (message.role !== "COACH") {
      return <MarkdownText>{content}</MarkdownText>;
    }

    return renderCoachContent(message);
  };

  const renderCoachContent = (message: any) => {
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
        const textToFind = replacement.textToReplace;
        const baseIndex = content.indexOf(textToFind);
        if (baseIndex !== -1) {
          let startIndex = baseIndex;
          const beforeText = content.substring(Math.max(0, baseIndex - 10), baseIndex);

          const emoji = replacement.plan.emoji || '';
          const prefixPatterns = [
            `**"${emoji} `,
            `**"${emoji}`,
            `**"`,
            `**`,
            `"${emoji} `,
            `"${emoji}`,
            `"`,
          ].filter(p => p.length > 0);

          for (const prefix of prefixPatterns) {
            if (beforeText.endsWith(prefix)) {
              startIndex = baseIndex - prefix.length;
              break;
            }
          }

          let endIndex = baseIndex + textToFind.length;
          const afterText = content.substring(endIndex, endIndex + 5);

          const suffixPatterns = [`"**`, `**`, `"`];
          for (const suffix of suffixPatterns) {
            if (afterText.startsWith(suffix)) {
              endIndex = endIndex + suffix.length;
              break;
            }
          }

          replacements.push({
            index: startIndex,
            length: endIndex - startIndex,
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

    const renderTextPart = (text: string, isFirst: boolean, isLast: boolean) => {
      let processedText = text;

      if (!isFirst) {
        if (processedText.match(/^[ ]*-[ ]/)) {
          processedText = processedText.replace(/^([ ]*)-( )/, '$1\\-$2');
        }
      }

      if (!isLast) {
        processedText = processedText.replace(/(\n\d+)\. $/g, '$1\\. ');
      }

      return <MarkdownText>{processedText}</MarkdownText>;
    };

    return (
      <>
        {parts.map((part, idx) => {
          if (typeof part === "string") {
            const isFirst = idx === 0;
            const isLast = idx === parts.length - 1;
            return <span key={idx}>{renderTextPart(part, isFirst, isLast)}</span>;
          }
          return part;
        })}
      </>
    );
  };

  if (isLoadingChats) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background relative z-50 overflow-hidden">
      <div className="flex-1 flex flex-col w-full max-w-full">
        {/* Header */}
        <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
          <div className="w-full max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate({ to: "/messages" })}
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
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: "/manage-ai-coach" })}
              >
                <Settings size={18} />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
          <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-4">
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

                const prevMessage = allMessages[index - 1];
                const messageDate = new Date(message.createdAt);
                const showDateDivider = !prevMessage ||
                  !isSameDay(messageDate, new Date(prevMessage.createdAt));

                return (
                  <div key={message.id}>
                    {showDateDivider && <DateDivider date={messageDate} />}
                    <div
                      className={`flex gap-3 max-w-full overflow-visible ${isUserMessage ? "flex-row-reverse" : "flex-row"
                        }`}
                    >
                      <div className="flex flex-col gap-1 max-w-full overflow-visible">
                        <MessageBubble
                          direction={isUserMessage ? "right" : "left"}
                          className={
                            isUserMessage
                              ? `bg-muted`
                              : "bg-transparent pl-0"
                          }
                        >
                          <div className="text-sm whitespace-pre-wrap">
                            {renderMessageContent(message)}
                          </div>
                        </MessageBubble>

                        {isCoachMessage && message.toolCalls && message.toolCalls.length > 0 && (
                          <CoachToolCallsCard
                            toolCalls={message.toolCalls}
                            plans={plans?.map(p => ({ id: p.id, goal: p.goal, emoji: p.emoji }))}
                          />
                        )}

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
            {isSendingMessage && (
              <div className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-muted-foreground/50 animate-pulse" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 pb-4 pt-2">
          <div className="w-full max-w-4xl mx-auto px-4 space-y-2">
            {pendingSession && (
              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl border",
                variants.fadedBg,
                variants.border
              )}>
                <span className="text-2xl">{pendingSession.activityEmoji || "📋"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {pendingSession.activityTitle}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • {format(new Date(pendingSession.date), "EEE, MMM d")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {pendingSession.planEmoji || "📋"} {pendingSession.planGoal}
                  </p>
                </div>
                <button
                  onClick={clearPendingSession}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 bg-muted/80 rounded-full px-3 py-2 border border-border">
              <div className="relative" ref={chatMenuRef}>
                <button
                  onClick={() => setShowChatMenu(!showChatMenu)}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                >
                  <MoreVertical size={18} />
                </button>
                {showChatMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setShowChatMenu(false);
                        createCoachChat({ title: null });
                      }}
                      disabled={isCreatingCoachChat}
                      className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors"
                    >
                      <Plus size={16} />
                      New chat
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 relative">
                {inputValue && /[*_~]/.test(inputValue) && (
                  <div className="absolute inset-0 pointer-events-none text-sm flex items-center">
                    <FormattedInputPreview text={inputValue} />
                  </div>
                )}
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={pendingSession ? "Ask about this session..." : "Ask anything"}
                  className={cn(
                    "w-full bg-transparent border-none outline-none placeholder:text-muted-foreground",
                    inputValue && /[*_~]/.test(inputValue) ? "text-transparent caret-foreground" : "text-foreground"
                  )}
                  disabled={isSendingMessage}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSendingMessage}
                className={`p-2 rounded-full transition-colors ${inputValue.trim() && !isSendingMessage
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

export default MessageAIPage;
