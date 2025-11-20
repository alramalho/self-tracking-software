import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Chat } from "@/contexts/ai/types";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTheme } from "@/contexts/theme/useTheme";

interface ConversationListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  currentUserId?: string;
}

export function ConversationListItem({
  chat,
  isActive,
  onClick,
  currentUserId,
}: ConversationListItemProps) {
  const { isDarkMode } = useTheme();

  // Determine display name and avatar based on chat type
  const getDisplayInfo = () => {
    switch (chat.type) {
      case "COACH":
        return {
          name: "Coach Oli",
          avatar: isDarkMode
            ? "/images/jarvis_logo_white_transparent.png"
            : "/images/jarvis_logo_transparent.png",
          isCoach: true,
        };
      case "DIRECT":
        // Find the other participant (not current user)
        const otherParticipant = chat.participants?.find(
          (p) => p.userId !== currentUserId
        );
        return {
          name: otherParticipant?.name || otherParticipant?.username || "Unknown User",
          avatar: otherParticipant?.picture,
          initials: otherParticipant?.name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "?",
          isCoach: false,
        };
      case "GROUP":
        return {
          name: chat.title || chat.planGroupName || "Group Chat",
          avatar: null,
          isGroup: true,
          isCoach: false,
        };
      default:
        return {
          name: "Unknown",
          avatar: null,
          isCoach: false,
        };
    }
  };

  const displayInfo = getDisplayInfo();
  const lastMessageTime = chat.lastMessage?.createdAt
    ? formatDistanceToNow(new Date(chat.lastMessage.createdAt), { addSuffix: true })
    : formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true });

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left",
        isActive && "bg-muted"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {displayInfo.isGroup ? (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Users size={20} className="text-muted-foreground" />
          </div>
        ) : (
          <Avatar className="w-12 h-12">
            <AvatarImage src={displayInfo.avatar || undefined} alt={displayInfo.name} />
            <AvatarFallback>{displayInfo.initials || displayInfo.name[0]}</AvatarFallback>
          </Avatar>
        )}
        {/* {displayInfo.isCoach && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">AI</span>
          </div>
        )} */}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-medium truncate">{displayInfo.name}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {lastMessageTime}
          </span>
        </div>
        {chat.lastMessage && (
          <p className="text-sm text-muted-foreground truncate">
            {chat.lastMessage.senderName && chat.type === "GROUP" && (
              <span className="font-medium">{chat.lastMessage.senderName}: </span>
            )}
            {chat.lastMessage.content}
          </p>
        )}
      </div>
    </button>
  );
}
