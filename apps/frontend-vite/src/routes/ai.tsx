import { MessageBubble } from "@/components/MessageBubble";
import { MessageFeedback } from "@/components/MessageFeedback";
import { PlanLink } from "@/components/PlanLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/theme/useTheme";
import { useAI } from "@/contexts/ai";
import { useThemeColors } from "@/hooks/useThemeColors";
import AppleLikePopover from "@/components/AppleLikePopover";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Send, Target, Loader2, Home, Plus, Menu, X, Pencil } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { usePlans } from "@/contexts/plans";

export const Route = createFileRoute("/ai")({
  component: AICoachPage,
});

function AICoachPage() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const themeColors = useThemeColors();
  const {
    chats,
    currentChatId,
    setCurrentChatId,
    messages,
    isLoadingMessages,
    createChat,
    isCreatingChat,
    sendMessage,
    isSendingMessage,
    updateChatTitle,
    isUpdatingChatTitle,
    submitFeedback,
    isSubmittingFeedback,
  } = useAI();
  const [inputValue, setInputValue] = useState("");
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
const { plans } = usePlans();
  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewChat = async () => {
    try {
      await createChat({ title: null });
      setIsSideMenuOpen(false);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  const handleSend = async () => {
    console.log("handleSend called", { inputValue, isSendingMessage, currentChatId });
    
    if (!inputValue.trim() || isSendingMessage || !currentChatId) {
      console.log("handleSend early return", { 
        hasInput: !!inputValue.trim(), 
        isSendingMessage, 
        currentChatId 
      });
      return;
    }

    const messageToSend = inputValue;
    console.log("Sending message:", messageToSend);
    setInputValue("");

    try {
      await sendMessage({ message: messageToSend, chatId: currentChatId });
      console.log("Message sent successfully");
    } catch (error) {
      console.error("Failed to send message:", error);
      // The error toast is already shown by the context
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditChat = (chatId: string, currentTitle: string | null) => {
    setEditingChatId(chatId);
    setEditTitleValue(currentTitle || "");
  };

  const handleSaveTitle = async () => {
    if (!editingChatId || !editTitleValue.trim()) return;

    try {
      await updateChatTitle({ chatId: editingChatId, title: editTitleValue });
      setEditingChatId(null);
      setEditTitleValue("");
    } catch (error) {
      console.error("Failed to update chat title:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingChatId(null);
    setEditTitleValue("");
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Side Menu */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out ${
          isSideMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Side Menu Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Chats</h2>
            <button
              onClick={() => setIsSideMenuOpen(false)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Side Menu Content */}
          <div className="flex-1 overflow-y-auto">
            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="w-full p-3 text-left hover:bg-muted transition-colors flex items-center gap-2 border-b border-border"
            >
              <Plus size={18} />
              <span className="font-medium">New Chat</span>
            </button>

            {/* Chat List */}
            <div className="py-2">
              {chats &&
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`w-full hover:bg-muted transition-colors ${
                      currentChatId === chat.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 p-3">
                      <button
                        onClick={() => {
                          setCurrentChatId(chat.id);
                          setIsSideMenuOpen(false);
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-medium truncate">
                          {chat.title || "New Conversation"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(chat.updatedAt).toLocaleDateString()}
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditChat(chat.id, chat.title);
                        }}
                        className="p-2 hover:bg-background rounded-full transition-colors flex-shrink-0"
                        aria-label="Edit chat title"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Back to Home */}
          <div className="border-t border-border">
            <button
              onClick={() => navigate({ to: "/" })}
              className="w-full p-4 text-left hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Home size={18} />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isSideMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSideMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto max-w-3xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSideMenuOpen(true)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <Menu size={20} />
                </button>
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!currentChatId ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <img
                src={coachIcon}
                alt="Coach Oli"
                className="w-32 h-32 opacity-70"
              />
              <div className="space-y-2">
                <h2 className="font-semibold text-2xl">Welcome to Coach Oli</h2>
                <p className="text-muted-foreground max-w-md">
                  Start a conversation with your AI coach to get personalized
                  guidance on your plans and goals.
                </p>
              </div>
              <Button
                onClick={handleNewChat}
                disabled={isCreatingChat}
                className={`${themeColors.button.solid} gap-2`}
                size="lg"
              >
                {isCreatingChat ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Chat...
                  </>
                ) : (
                  <>
                    <Plus size={20} />
                    Start New Chat
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="container mx-auto max-w-3xl px-4 py-6 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : !messages || messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <img
                    src={coachIcon}
                    alt="Coach Oli"
                    className="w-24 h-24 opacity-50"
                  />
                  <div>
                    <h3 className="font-semibold text-lg">No messages yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Start a conversation with Coach Oli below!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "USER" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* {message.role === "COACH" && (
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={coachIcon} alt="Coach Oli" />
                        <AvatarFallback>CO</AvatarFallback>
                      </Avatar>
                    )} */}
                    {/* {message.role === "USER" && (
                      <Avatar className="w-10 h-10 flex-shrink-0 self-end">
                        <AvatarImage
                          src={currentUser?.picture || ""}
                          alt={currentUser?.name || ""}
                        />
                        <AvatarFallback>
                          {(currentUser?.name || "U")[0]}
                        </AvatarFallback>
                      </Avatar>
                    )} */}
                    <div className="flex flex-col gap-1">
                      <MessageBubble
                        direction={message.role === "USER" ? "right" : "left"}
                        className={
                          message.role === "USER"
                            ? `bg-muted`
                            : "bg-transparent px-1"
                        }
                      >
                        {message.role === "COACH" ? (
                          <div className="text-sm whitespace-pre-wrap prose prose-sm max-w-none">
                            <ReactMarkdown
                              components={{
                                a: ({ node, href, children, ...props }) => {

                                  // Check if this is a plan reference: [text](plan://goal-with-hyphens)
                                  if (href?.startsWith("plan-goal-")) {
                                    const displayText =
                                      typeof children === "string"
                                        ? children
                                        : Array.isArray(children)
                                          ? children.join("")
                                          : "";

                                    // Extract the goal from the href and convert hyphens back to spaces
                                    const hyphenatedGoal = href.replace("plan-goal-", "").trim();
                                    const planGoal = hyphenatedGoal.replace(/-/g, " ");

                                    // Find exact plan match (case-insensitive)
                                    const plan = plans?.find(
                                      (p) => p.goal.toLowerCase() === planGoal.toLowerCase()
                                    );

                                    if (!plan) {
                                      return <span>{displayText}</span>;
                                    }

                                    return (
                                      <PlanLink
                                        planId={plan.id}
                                        displayText={displayText}
                                        emoji={plan.emoji || undefined}
                                      />
                                    );
                                  }
                                  return (
                                    <a href={href} {...props}>
                                      {children}
                                    </a>
                                  );
                                },
                                p: ({ children }) => (
                                  <p className="mb-0">{children}</p>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}
                      </MessageBubble>
                      {message.role === "COACH" && (
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
                ))
              )}
              {isSendingMessage && (
                <div className="flex gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={coachIcon} alt="Coach Oli" />
                    <AvatarFallback>CO</AvatarFallback>
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
          )}
        </div>

        {/* Input - Only show when chat is selected */}
        {currentChatId && (
          <div className="sticky bottom-0 bg-card/80 backdrop-blur-lg border-t border-border">
            <div className="container mx-auto max-w-3xl px-4 py-4">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your plans, goals, or get advice..."
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
        )}
      </div>

      {/* Edit Chat Title Popover */}
      <AppleLikePopover
        open={!!editingChatId}
        onClose={handleCancelEdit}
        title="Edit Chat Title"
      >
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-semibold">Edit Chat Title</h2>
          <Input
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            placeholder="Enter chat title..."
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveTitle();
              }
            }}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTitle}
              disabled={!editTitleValue.trim() || isUpdatingChatTitle}
              className={themeColors.button.solid}
            >
              {isUpdatingChatTitle ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </div>
  );
}

export default AICoachPage;
