import { ConversationListItem } from "@/components/ConversationListItem";
import UserSearch, { type UserSearchResult } from "@/components/UserSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme/useTheme";
import { useAI } from "@/contexts/ai";
import { useCurrentUser } from "@/contexts/users";
import { useMessages } from "@/contexts/messages";
import { usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

interface HumanCoach {
  id: string;
  ownerId: string;
  type: "HUMAN";
  details: {
    title: string;
    bio?: string;
    focusDescription: string;
  };
  owner: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
}

export const Route = createFileRoute("/messages/")({
  component: MessagesPage,
});

function MessagesPage() {
  const { isDarkMode } = useTheme();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const api = useApiWithAuth();
  const { plans } = usePlans();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const {
    chats,
    isLoadingChats,
  } = useMessages();
  const {
    createCoachChat,
    isCreatingCoachChat,
  } = useAI();

  const coachIcon = isDarkMode
    ? "/images/jarvis_logo_white_transparent.png"
    : "/images/jarvis_logo_transparent.png";

  // Fetch all human coaches
  const { data: humanCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const response = await api.get<HumanCoach[]>("/coaches");
      return response.data;
    },
  });

  // Get coaches from user's plans (plans with coachId that have human coaches)
  const pinnedCoaches = useMemo(() => {
    if (!plans || !humanCoaches) return [];

    const coachesWithPlans: Array<{
      coach: HumanCoach;
      plan: { id: string; goal: string; emoji: string | null };
    }> = [];

    for (const plan of plans) {
      const planAny = plan as any;
      if (planAny.coachId && planAny.isCoached) {
        const coach = humanCoaches.find(c => c.id === planAny.coachId);
        if (coach) {
          coachesWithPlans.push({
            coach,
            plan: { id: plan.id, goal: plan.goal, emoji: plan.emoji },
          });
        }
      }
    }

    return coachesWithPlans;
  }, [plans, humanCoaches]);

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
        if (chat.type !== "DIRECT") return true;

        const otherParticipant = chat.participants?.find(p => p.userId !== currentUser?.id);
        if (!otherParticipant?.userId) return true;

        if (seenUserIds.has(otherParticipant.userId)) return false;

        seenUserIds.add(otherParticipant.userId);
        return true;
      });

    return latestCoach ? [latestCoach, ...deduplicatedChats] : deduplicatedChats;
  }, [chats, coachChats, currentUser?.id]);

  const handleStartAIChat = async () => {
    try {
      await createCoachChat({ title: null });
      navigate({ to: "/message-ai" });
    } catch (error) {
      console.error("Failed to create AI chat:", error);
      toast.error("Failed to start AI chat");
    }
  };

  const handleUserSelect = async (user: UserSearchResult) => {
    // Navigate to the message route with the user's ID
    navigate({ to: "/message/$userId", params: { userId: user.userId } });
  };

  const handleChatClick = (chat: any) => {
    if (chat.type === "COACH") {
      navigate({ to: "/message-ai" });
    } else if (chat.type === "DIRECT") {
      const otherParticipant = chat.participants?.find((p: any) => p.userId !== currentUser?.id);
      if (otherParticipant?.userId) {
        navigate({ to: "/message/$userId", params: { userId: otherParticipant.userId } });
      }
    }
  };

  const handleCoachClick = async (coach: HumanCoach) => {
    // Navigate to direct message with the coach's owner
    navigate({ to: "/message/$userId", params: { userId: coach.ownerId } });
  };

  return (
    <div className="flex h-screen bg-background relative z-50 overflow-hidden">
      <div className="flex-1 flex flex-col w-full max-w-full">
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
                <ArrowLeft size={18} />
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
              {/* Pinned Section - Coaches from plans + AI Coach */}
              <div className="p-3 space-y-2">
                {/* Pinned Human Coaches from Plans */}
                {pinnedCoaches.map(({ coach, plan }) => (
                  <button
                    key={`${coach.id}-${plan.id}`}
                    onClick={() => handleCoachClick(coach)}
                    className={cn(
                      "w-full p-3 flex items-center gap-3 rounded-3xl transition-colors text-left",
                      variants.fadedBg,
                      "border",
                      variants.border,
                      "hover:opacity-80"
                    )}
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={coach.owner.picture || undefined} alt={coach.owner.name || coach.owner.username} />
                      <AvatarFallback>
                        {coach.owner.name?.[0] || coach.owner.username[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{coach.owner.name || coach.owner.username}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground")}>
                          Coach
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {plan.emoji || "📋"} {plan.goal}
                      </p>
                    </div>
                  </button>
                ))}

                {/* AI Coach - Always available */}
                <button
                  onClick={() => {
                    if (coachChats[0]) {
                      navigate({ to: "/message-ai" });
                    } else {
                      handleStartAIChat();
                    }
                  }}
                  disabled={isCreatingCoachChat}
                  className={cn(
                    "w-full p-3 flex items-center gap-3 rounded-3xl transition-colors text-left",
                    pinnedCoaches.length === 0 ? cn(variants.fadedBg, "border", variants.border) : "hover:bg-muted/50"
                  )}
                >
                  <Avatar className="w-11 h-11 bg-transparent">
                    <AvatarImage src={coachIcon} alt="Coach Oli" className="object-contain" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Coach Oli</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        AI
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isCreatingCoachChat ? "Starting chat..." : "Your AI assistant"}
                    </p>
                  </div>
                </button>
              </div>

              <div className="h-px bg-border mx-3" />

              {/* Other conversations */}
              {displayChats
                .filter((chat) => {
                  if (chat.type === "COACH") return false;
                  if (chat.type === "DIRECT") {
                    const otherParticipant = chat.participants?.find(p => p.userId !== currentUser?.id);
                    const isCoachUser = pinnedCoaches.some(({ coach }) => coach.ownerId === otherParticipant?.userId);
                    if (isCoachUser) return false;
                  }
                  return true;
                })
                .map((chat) => (
                  <ConversationListItem
                    key={chat.id}
                    chat={chat}
                    isActive={false}
                    onClick={() => handleChatClick(chat)}
                    currentUserId={currentUser?.id}
                  />
                ))}

              {/* Empty state for no other conversations */}
              {displayChats.filter((chat) => {
                if (chat.type === "COACH") return false;
                if (chat.type === "DIRECT") {
                  const otherParticipant = chat.participants?.find(p => p.userId !== currentUser?.id);
                  const isCoachUser = pinnedCoaches.some(({ coach }) => coach.ownerId === otherParticipant?.userId);
                  if (isCoachUser) return false;
                }
                return true;
              }).length === 0 && (
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
      </div>
    </div>
  );
}

export default MessagesPage;
