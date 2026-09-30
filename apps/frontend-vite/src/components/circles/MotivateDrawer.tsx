import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { useEncouragementActions } from "./api";
import { PersonAvatar } from "./components";
import { firstName } from "./model";
import type { MotivateDrawerProps } from "./types";

export function MotivateDrawer({
  circleId,
  member,
  onClose,
}: MotivateDrawerProps) {
  const queryClient = useQueryClient();
  const { openEncouragementChat, sendEncouragement } =
    useEncouragementActions();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const chatId = useRef<string>(undefined);
  const inFlight = useRef(false);
  const name = firstName(member.user);
  const send = async () => {
    if (!message.trim() || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(undefined);
    try {
      chatId.current ??= await openEncouragementChat(circleId, member.user.id);
      await sendEncouragement(chatId.current, message);
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({
        queryKey: ["messages", chatId.current],
      });
    } catch (failure) {
      setError(
        toApiErrorMessage(
          failure,
          "Couldn't send your encouragement. Please try again.",
        ),
      );
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  return (
    <AppleLikePopover
      open
      title={`Motivate ${name}`}
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <form
        data-testid="motivate-drawer"
        className="flex flex-col gap-5 pt-8"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <PersonAvatar
            name={member.user.name ?? member.user.username ?? null}
            picture={member.user.picture}
            size={64}
          />
          <h2 className="text-2xl font-bold text-foreground">
            {sent ? `Sent to ${name}` : `Motivate ${name}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {sent
              ? "Your encouragement is in your private chat."
              : "A few words from you could make the difference."}
          </p>
        </div>
        {sent ? (
          <Button type="button" className="h-12 w-full" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Remind them why they started, celebrate their effort, or offer to
              join them for a session.
            </p>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground">
              Your message
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={sending}
                placeholder={`What would help ${name} keep going?`}
                maxLength={2000}
                className="min-h-[120px] text-base font-normal text-foreground"
              />
            </label>
            <p className="text-sm text-muted-foreground">{`Only ${name} will see this message, in your private chat.`}</p>
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="h-12 w-full"
              disabled={!message.trim() || sending}
              loading={sending}
            >
              Send encouragement
            </Button>
          </>
        )}
      </form>
    </AppleLikePopover>
  );
}
