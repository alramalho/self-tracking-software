import AppleLikePopover from "@/components/AppleLikePopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/contexts/messages";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface CoachingRequestPopoverProps {
  open: boolean;
  onClose: () => void;
  coach: {
    id: string; // This is the coach's user ID (ownerId)
    name?: string | null;
    username?: string | null;
    picture?: string | null;
    title?: string | null;
  };
}

export function CoachingRequestPopover({
  open,
  onClose,
  coach,
}: CoachingRequestPopoverProps) {
  const { sendMessage, createDirectChat, isSendingMessage, isCreatingDirectChat } = useMessages();
  const [step, setStep] = useState<"goal" | "struggles">("goal");
  const [goal, setGoal] = useState("");
  const [struggles, setStruggles] = useState("");

  const isSending = isSendingMessage || isCreatingDirectChat;

  const handleSendRequest = async () => {
    if (!goal.trim() || isSending) return;

    try {
      // Create or get existing direct chat with the coach
      const chat = await createDirectChat(coach.id);

      // Format the coaching request message
      const message = `Hi! I'd like to request coaching from you.

**My Goal:** ${goal.trim()}

${struggles.trim() ? `**Current Struggles:** ${struggles.trim()}` : ""}

Looking forward to working with you!`;

      // Send the message
      await sendMessage({ message, chatId: chat.id });

      toast.success(`Coaching request sent to ${coach.name || coach.username}!`);

      // Reset and close
      setGoal("");
      setStruggles("");
      setStep("goal");
      onClose();
    } catch (error) {
      console.error("Failed to send coaching request:", error);
      toast.error("Failed to send coaching request");
    }
  };

  const handleClose = () => {
    setGoal("");
    setStruggles("");
    setStep("goal");
    onClose();
  };

  const displayName = coach.name || coach.username || "Coach";
  const initials =
    coach.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <AppleLikePopover
      open={open}
      onClose={handleClose}
      title="Request Coaching"
    >
      <div className="flex flex-col gap-4 pt-4">
        {/* Coach header */}
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={coach.picture || undefined} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{displayName}</h3>
            {coach.title && (
              <p className="text-sm text-muted-foreground">{coach.title}</p>
            )}
          </div>
        </div>

        {step === "goal" ? (
          <>
            {/* Goal input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                What's your goal?
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Run a marathon, lose 10kg, build a consistent workout routine..."
                className="w-full min-h-[100px] p-3 bg-muted/80 rounded-xl border border-border text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isSending}
                autoFocus
              />
            </div>

            <Button
              onClick={() => setStep("struggles")}
              disabled={!goal.trim()}
              className="w-full"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        ) : (
          <>
            {/* Struggles input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                What are your current struggles? <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={struggles}
                onChange={(e) => setStruggles(e.target.value)}
                placeholder="e.g., I can't stay consistent, I don't know where to start, I lack motivation..."
                className="w-full min-h-[100px] p-3 bg-muted/80 rounded-xl border border-border text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isSending}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("goal")}
                disabled={isSending}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSendRequest}
                disabled={!goal.trim() || isSending}
                className="flex-1"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Send Request
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppleLikePopover>
  );
}
