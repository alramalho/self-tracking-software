import { useApiWithAuth } from "@/api";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import type { ReportDialogProps, ReportReason, ReportReasonOption } from "./types";

// Reports reach the owner, who reviews them within 24 hours (backend routes/moderation.ts).
const reasons: ReportReasonOption[] = [
  { value: "SPAM", label: "Spam or scam" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "HATE", label: "Hate speech" },
  { value: "SEXUAL", label: "Nudity or sexual content" },
  { value: "SELF_HARM", label: "Self-harm or suicide" },
  { value: "OTHER", label: "Something else" },
];

export function ReportDialog({ target, onClose }: ReportDialogProps) {
  const api = useApiWithAuth();
  const [reason, setReason] = useState<ReportReason>();
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: async () =>
      api.post("/moderation/reports", {
        kind: target!.kind,
        targetId: target!.id,
        reason,
        note: note.trim() || undefined,
      }),
  });
  const close = () => {
    setReason(undefined);
    setNote("");
    send.reset();
    onClose();
  };

  return (
    <AppleLikePopover open={!!target} onClose={close} title="Report">
      {send.isSuccess ? (
        <div className="flex flex-col gap-3 pt-4">
          <h2 className="text-lg font-bold text-foreground">
            Thanks — we'll review this within 24 hours
          </h2>
          <p className="text-sm text-muted-foreground">
            We remove content and accounts that break our Terms. You can also
            block this person so you no longer see each other.
          </p>
          <Button className="w-full h-12" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-4">
          <h2 className="text-lg font-bold text-foreground pr-10">
            Why are you reporting {target?.label}?
          </h2>
          <div
            role="radiogroup"
            className="overflow-hidden rounded-2xl bg-card border border-border"
          >
            {reasons.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={reason === option.value}
                onClick={() => setReason(option.value)}
                className={cn(
                  "flex w-full min-h-[50px] items-center px-4 text-left text-base text-foreground hover:bg-muted/60",
                  index > 0 && "border-t border-border"
                )}
              >
                <span className="flex-1">{option.label}</span>
                {reason === option.value && <Check className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Add details (optional)"
            placeholder="Add details (optional)"
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-[80px]"
          />
          {send.error && (
            <p className="text-sm text-red-500">{toApiErrorMessage(send.error)}</p>
          )}
          <Button
            className="w-full h-12"
            disabled={!reason || send.isPending}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "Sending…" : "Send report"}
          </Button>
        </div>
      )}
    </AppleLikePopover>
  );
}
