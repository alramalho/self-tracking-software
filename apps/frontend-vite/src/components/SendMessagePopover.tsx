import AppleLikePopover from "@/components/AppleLikePopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useApiWithAuth } from "@/api";
import { createDirectChat } from "@/contexts/ai/service";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface SendMessagePopoverProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
    picture?: string | null;
  };
}

export function SendMessagePopover({
  open,
  onClose,
  user,
}: SendMessagePopoverProps) {
  const api = useApiWithAuth();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      // Create or get existing direct chat with the user
      const chat = await createDirectChat(api, user.id);

      // Send the message
      await api.post(`/chats/${chat.id}/messages`, { message: message.trim() });

      toast.success(`Message sent to ${user.name || user.username}!`);
      setMessage("");
      onClose();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = user.name || user.username || "User";
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <AppleLikePopover
      open={open}
      onClose={onClose}
      title={`Message ${displayName}`}
    >
      <div className="flex flex-col gap-4 pt-4">
        {/* User header */}
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={user.picture || undefined} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{displayName}</h3>
            {user.username && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
          </div>
        </div>

        {/* Message input - ChatGPT style */}
        <div className="flex items-center gap-3 bg-muted/80 rounded-full px-4 py-2 border border-border">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            disabled={isSending}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className={`p-2 rounded-full transition-colors ${
              message.trim() && !isSending
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted-foreground/20 text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isSending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </AppleLikePopover>
  );
}
