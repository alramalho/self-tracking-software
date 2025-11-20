import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { type Chat } from "@/contexts/ai/types";
import { useTheme } from "@/contexts/theme/useTheme";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useNavigate } from "@tanstack/react-router";
import { Target, Users, Info, Menu } from "lucide-react";

interface ChatHeaderProps {
  chat: Chat;
  currentUserId?: string;
  onMenuClick?: () => void; // For mobile menu toggle
}

export function ChatHeader({ chat, currentUserId, onMenuClick }: ChatHeaderProps) {
  const { isDarkMode } = useTheme();
  const themeColors = useThemeColors();
  const navigate = useNavigate();

  // Coach chat header - special treatment like in ai.tsx
  if (chat.type === "COACH") {
    const coachIcon = isDarkMode
      ? "/images/jarvis_logo_white_transparent.png"
      : "/images/jarvis_logo_transparent.png";

    return (
      <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              {onMenuClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onMenuClick}
                  className="lg:hidden"
                >
                  <Menu size={20} />
                </Button>
              )}
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
    );
  }

  // Direct message header
  if (chat.type === "DIRECT") {
    const otherParticipant = chat.participants?.find(
      (p) => p.userId !== currentUserId
    );
    const displayName = otherParticipant?.name || otherParticipant?.username || "Unknown User";
    const initials = otherParticipant?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

    return (
      <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              {onMenuClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onMenuClick}
                  className="lg:hidden"
                >
                  <Menu size={20} />
                </Button>
              )}
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
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Navigate to user profile
                if (otherParticipant?.username) {
                  navigate({ to: `/profile/${otherParticipant.username}` });
                }
              }}
              className="gap-2"
            >
              <Info size={16} />
              Profile
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Group chat header
  if (chat.type === "GROUP") {
    const displayName = chat.title || chat.planGroupName || "Group Chat";
    const participantCount = chat.participants?.length || 0;

    return (
      <div className="flex-shrink-0 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              {onMenuClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onMenuClick}
                  className="lg:hidden"
                >
                  <Menu size={20} />
                </Button>
              )}
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Users size={20} className="text-muted-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{displayName}</h1>
                <p className="text-xs text-muted-foreground">
                  {participantCount} {participantCount === 1 ? "member" : "members"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Show group info/members modal
              }}
              className="gap-2"
            >
              <Info size={16} />
              Details
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
