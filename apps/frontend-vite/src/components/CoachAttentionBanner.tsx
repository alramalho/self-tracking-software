import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useSession } from "@/contexts/auth";
import {
  getCoachAttentionItems,
  startCoachAttentionAction,
} from "@/contexts/ai/service";
import { type CoachAttentionItem } from "@/contexts/ai/types";
import { useMessages } from "@/contexts/messages";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import {
  getCoachAvatar,
  getCoachPersonalityConfig,
} from "@/lib/coachPersonality";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

const severityRank: Record<CoachAttentionItem["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const fadeStepTransition = {
  opacity: { duration: 0.18 },
};

export function useCoachAttentionItems(enabled = true) {
  const api = useApiWithAuth();
  const { isSignedIn, isLoaded } = useSession();

  const { data: attentionItems = [] } = useQuery({
    queryKey: ["coach-attention"],
    queryFn: () => getCoachAttentionItems(api),
    enabled: enabled && !!isSignedIn && isLoaded,
    staleTime: 60_000,
  });

  return useMemo(
    () =>
      attentionItems.sort(
        (a, b) =>
          severityRank[a.severity] - severityRank[b.severity] ||
          a.title.localeCompare(b.title),
      ),
    [attentionItems],
  );
}

function attentionHeadline(item: CoachAttentionItem) {
  if (item.kind === "SPECIFIC_AUTO_ARCHIVED") return "Plan archived";
  if (item.kind === "PLAN_PAST_END_DATE") return "Plan passed its end date";
  return item.kind === "SPECIFIC_NO_FUTURE_SESSIONS"
    ? "Next sessions need planning"
    : "Next week needs planning";
}

function factValue(item: CoachAttentionItem, label: string) {
  return item.facts.find((fact) => fact.label === label)?.value;
}

function formatHumanDate(value?: string) {
  if (!value || value === "None" || value === "No end date") {
    return value?.toLowerCase() || "not set";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function CoachAttentionDrawer({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CoachAttentionItem[];
}) {
  const api = useApiWithAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setCurrentChatId } = useMessages();
  const { archivePlan, isArchivingPlan } = usePlans();
  const { currentUser } = useCurrentUser();
  const [step, setStep] = useState(0);
  const aiCoach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const coachAvatar = getCoachAvatar(currentUser?.coachPersonality, "thinking");
  const criticalCount = items.filter(
    (item) => item.severity === "critical",
  ).length;
  const warningCount = items.filter(
    (item) => item.severity === "warning",
  ).length;
  const activeItem = step > 0 ? items[step - 1] : null;
  const totalSteps = items.length + 1;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const startAttentionAction = useMutation({
    mutationFn: (input: { item: CoachAttentionItem; guidance?: string }) =>
      startCoachAttentionAction(api, {
        dedupeKey: input.item.dedupeKey,
        guidance: input.guidance,
      }),
    onSuccess: ({ chat, messages }) => {
      setCurrentChatId(chat.id);
      queryClient.setQueryData(
        ["messages", chat.id],
        (oldMessages: any[] = []) => {
          const existingIds = new Set(oldMessages.map((message) => message.id));
          return [
            ...oldMessages,
            ...messages.filter((message) => !existingIds.has(message.id)),
          ];
        },
      );
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["messages", chat.id] });
      queryClient.invalidateQueries({ queryKey: ["coach-attention"] });
      onOpenChange(false);
      navigate({ to: "/message-ai" });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || "Coach could not prepare this update",
      );
    },
  });

  const startPlanUpdate = (item: CoachAttentionItem, guidance?: string) => {
    if (item.primaryAction.type === "VIEW_COACH_CHAT") {
      onOpenChange(false);
      navigate({ to: "/message-ai" });
      return;
    }

    startAttentionAction.mutate({ item, guidance });
  };

  const archivePastEndDatePlan = async (item: CoachAttentionItem) => {
    const planId = item.planIds[0];
    if (!planId) return;

    await archivePlan(planId);
    await queryClient.invalidateQueries({ queryKey: ["coach-attention"] });

    if (items.length <= 1) {
      onOpenChange(false);
      return;
    }

    setStep((current) => Math.min(current, items.length - 1));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="px-5 pb-2 text-left">
          <DrawerTitle className="sr-only">Plan updates</DrawerTitle>
        </DrawerHeader>

        <div className="px-5 pb-3">
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === step
                    ? "w-6 bg-foreground"
                    : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>

          <AnimatePresence initial={false} mode="wait">
            {step === 0 ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeStepTransition}
                className="flex min-h-[420px] flex-col items-center justify-between text-center"
              >
                <div className="flex flex-col items-center">
                  <div className="relative mb-5">
                    <div className="absolute inset-0 rounded-full bg-amber-400/20 motion-safe:animate-ping" />
                    <img
                      src={coachAvatar}
                      alt={aiCoach.label}
                      className="relative z-10 h-28 w-28 rounded-full object-contain"
                    />
                    <div className="absolute -right-1 bottom-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-background bg-amber-500 text-background shadow-sm">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    {items.length} plan update{items.length === 1 ? "" : "s"}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {aiCoach.name} found plans that need their next scheduled
                    step.
                  </p>

                  <div className="mt-6 grid w-full grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-muted/50 p-4">
                      <p className="text-3xl font-semibold text-foreground">
                        {criticalCount}
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        need a decision
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-4">
                      <p className="text-3xl font-semibold text-foreground">
                        {warningCount}
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        ending soon
                      </p>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => setStep(1)}>
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            ) : activeItem ? (
              <motion.div
                key={activeItem.dedupeKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeStepTransition}
                className="flex min-h-[420px] flex-col justify-between"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <img
                      src={coachAvatar}
                      alt={aiCoach.label}
                      className="h-24 w-24 rounded-full object-contain"
                    />
                    <div className="absolute -right-2 bottom-1 flex h-12 w-12 items-center justify-center rounded-full border border-background bg-card text-2xl shadow-sm">
                      {activeItem.planEmoji || "🎯"}
                    </div>
                  </div>

                  <div className="mb-3 inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                    {step} of {items.length}
                  </div>

                  <h2 className="max-w-sm text-3xl font-semibold leading-tight text-foreground">
                    {attentionHeadline(activeItem)}
                  </h2>
                  <p className="mt-3 max-w-sm text-xl font-semibold leading-tight text-muted-foreground">
                    {activeItem.planGoal}
                  </p>

                  <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    Last planned:{" "}
                    {formatHumanDate(
                      factValue(activeItem, "Last planned session"),
                    )}
                    {" · "}
                    Ends: {formatHumanDate(factValue(activeItem, "Plan end"))}
                  </p>
                </div>

                <div className="mt-6 space-y-2">
                  <Button
                    className="w-full rounded-2xl"
                    disabled={startAttentionAction.isPending}
                    onClick={() => startPlanUpdate(activeItem)}
                  >
                    {startAttentionAction.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {activeItem.kind === "PLAN_PAST_END_DATE" &&
                      !startAttentionAction.isPending && (
                        <MessageCircle className="mr-2 h-4 w-4" />
                      )}
                    {activeItem.primaryAction.type === "VIEW_COACH_CHAT"
                      ? "Open coach chat"
                      : activeItem.kind === "PLAN_PAST_END_DATE"
                        ? "Talk to coach"
                      : "Let coach prepare the update"}
                  </Button>
                  {activeItem.kind === "PLAN_PAST_END_DATE" && (
                    <Button
                      className="w-full rounded-2xl"
                      variant="outline"
                      disabled={isArchivingPlan || startAttentionAction.isPending}
                      onClick={() => archivePastEndDatePlan(activeItem)}
                    >
                      {isArchivingPlan ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="mr-2 h-4 w-4" />
                      )}
                      Archive plan
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setStep((current) => Math.max(0, current - 1))
                      }
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      disabled={step >= items.length}
                      onClick={() =>
                        setStep((current) =>
                          Math.min(items.length, current + 1),
                        )
                      }
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <DrawerFooter className="pt-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
