
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useNavigate } from "@tanstack/react-router";
import { addMonths, isBefore } from "date-fns";
import { Archive, ArchiveRestore, Loader2, Plus, PlusSquare, RefreshCw, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import Divider from "./Divider";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { capitalize } from "@/lib/utils";
import { twMerge } from "tailwind-merge";

// Helper function to check if a plan is expired
export const isPlanExpired = (plan: {
  finishingDate: Date | null;
}): boolean => {
  if (!plan.finishingDate) return false;
  return isBefore(plan.finishingDate, new Date());
};

// Helper function to check if a plan is archived
export const isPlanArchived = (plan: {
  archivedAt?: Date | null;
}): boolean => {
  return !!plan.archivedAt;
};

// Function to sort plans by creation date (newest first)
const sortPlansByDate = (plans: CompletePlan[]): CompletePlan[] => {
  return [...plans].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

interface PlanCardProps {
  plan: CompletePlan;
  isSelected: boolean;
  isLoading?: boolean;
  onSelect: (planId: string) => void;
  onInactivePlanClick?: (plan: CompletePlan) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isSelected,
  isLoading = false,
  onSelect,
  onInactivePlanClick,
}) => {
  const isExpired = isPlanExpired(plan);
  const isArchived = isPlanArchived(plan);
  const isInactive = isExpired || isArchived;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const handleCardClick = () => {
    if (isInactive && onInactivePlanClick) {
      onInactivePlanClick(plan);
    } else {
      onSelect(plan.id!);
    }
  };

  return (
    <div
      className={twMerge(
        "relative rounded-lg"
      )}
    >
      {isArchived && (
        <div className="absolute top-1 left-1 z-10 flex bg-transparent">
          <Archive className={`h-4 w-4 ${variants.fadedText}`} />
        </div>
      )}
      <div
        className={`relative flex items-center justify-center h-20 rounded-lg bg-card cursor-pointer overflow-hidden transition-all ${
          isSelected
            ? variants.veryFadedBg
            : "hover:bg-muted/60"
        }`}
        onClick={handleCardClick}
        style={{ opacity: isInactive ? 0.5 : 1 }}
      >
        {plan.emoji ? (
          <span
            className={`text-5xl transition-opacity duration-200 ${
              isLoading ? "opacity-35" : "opacity-100"
            }`}
          >
            {plan.emoji}
          </span>
        ) : (
          <span
            className={`text-xl text-muted-foreground font-medium transition-opacity duration-200 ${
              isLoading ? "opacity-35" : "opacity-100"
            }`}
          >
            {plan.goal.substring(0, 2).toUpperCase()}
          </span>
        )}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Loading plan"
          >
            <Loader2 className={`h-6 w-6 animate-spin ${variants.text}`} />
          </div>
        )}
      </div>
    </div>
  );
};

interface PlansRendererProps {
  initialSelectedPlanId?: string | null;
  scrollTo?: string;
}

const PlansRenderer: React.FC<PlansRendererProps> = ({
  initialSelectedPlanId,
  scrollTo,
}) => {
  const { plans, isLoadingPlans, isFetchingPlans, upsertPlan, deletePlan, archivePlan, unarchivePlan, isArchivingPlan, isUnarchivingPlan } = usePlans();
  const { maxPlans, userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const navigate = useNavigate();

  const [selectedPlanId, setSelectedPlanId] = useState<
    string | null | undefined
  >(
    initialSelectedPlanId
  );
  const [showOldPlans, setShowOldPlans] = useState(false);
  const [inactivePlanPopover, setInactivePlanPopover] = useState<CompletePlan | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [showPlanLimitPopover, setShowPlanLimitPopover] = useState(false);
  const [settlingPlanId, setSettlingPlanId] = useState<string | null>(null);

  const orderedPlans = useMemo(() => {
    return plans ? sortPlansByDate(plans as CompletePlan[]) : [];
  }, [plans]);

  const displayedPlans = useMemo(() => {
    return showOldPlans
      ? orderedPlans
      : orderedPlans.filter((plan) => !isPlanExpired(plan) && !isPlanArchived(plan));
  }, [orderedPlans, showOldPlans]);

  useEffect(() => {
    setSelectedPlanId(initialSelectedPlanId);
  }, [initialSelectedPlanId]);

  const selectedPlan = useMemo(() => {
    if (selectedPlanId === null) return null;

    const explicitPlan = selectedPlanId
      ? displayedPlans.find((plan) => plan.id === selectedPlanId)
      : null;

    if (explicitPlan) return explicitPlan;

    return displayedPlans[0] || null;
  }, [displayedPlans, selectedPlanId]);

  const activeSelectedPlanId = selectedPlan?.id ?? null;

  useEffect(() => {
    if (!activeSelectedPlanId) {
      setSettlingPlanId(null);
      return;
    }

    setSettlingPlanId(activeSelectedPlanId);
    const timeoutId = window.setTimeout(() => {
      setSettlingPlanId(null);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [activeSelectedPlanId]);

  if (isLoadingPlans) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  const userPlanCount = plans?.length || 0;

  const handleCreatePlanClick = () => {
    if (userPlanCount >= maxPlans) {
      setShowPlanLimitPopover(true);
    } else {
      navigate({ to: "/create-plan" });
    }
  };

  if (plans && plans.length === 0) {
    return (
      <>
        <Button
          variant="outline"
          className="bg-muted/50 w-full h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-border text-muted-foreground"
          onClick={handleCreatePlanClick}
        >
          <PlusSquare className="h-8 w-8 mb-2 text-muted-foreground/70" />
          <span>Create new Plan</span>
        </Button>

        {/* Plan Limit Popover */}
        <AppleLikePopover
          open={showPlanLimitPopover}
          onClose={() => setShowPlanLimitPopover(false)}
        >
          <div className="flex flex-col items-start justify-center p-4">
            <h1 className="text-2xl font-bold mb-8 mt-2">Create New Plan</h1>
            <span
              className={twMerge(
                "text-3xl font-cursive flex items-center gap-2 my-3",
                userPaidPlanType === "FREE"
                  ? "text-gray-500"
                  : userPaidPlanType === "PLUS"
                  ? "text-blue-500"
                  : "text-indigo-500"
              )}
            >
              On {capitalize(userPaidPlanType || "FREE")} Plan
            </span>
            <p className="mb-5">
              You have reached the maximum number of plans for your account.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setShowPlanLimitPopover(false);
                setShowUpgradePopover(true);
              }}
            >
              Upgrade
            </Button>
          </div>
        </AppleLikePopover>
      </>
    );
  }

  const handlePlanSelect = (planId: string) => {
    if (activeSelectedPlanId === planId) {
      setSelectedPlanId(null);
    } else {
      setSelectedPlanId(planId);
    }
  };

  const handleInactivePlanClick = (plan: CompletePlan) => {
    setInactivePlanPopover(plan);
  };

  const handleReactivate = async () => {
    if (!inactivePlanPopover || isReactivating) return;

    setIsReactivating(true);
    try {
      const oneMonthLater = addMonths(new Date(), 1);
      await upsertPlan({
        planId: inactivePlanPopover.id!,
        updates: { finishingDate: oneMonthLater }
      });
      toast.success("Plan reactivated");
      setInactivePlanPopover(null);
    } catch (error) {
      toast.error("Failed to reactivate plan");
      console.error("Failed to reactivate plan:", error);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleArchive = async () => {
    if (!inactivePlanPopover) return;

    try {
      await archivePlan(inactivePlanPopover.id!);
      setInactivePlanPopover(null);
    } catch (error) {
      toast.error("Failed to archive plan");
      console.error("Failed to archive plan:", error);
    }
  };

  const handleUnarchive = async () => {
    if (!inactivePlanPopover) return;

    try {
      await unarchivePlan(inactivePlanPopover.id!);
      setInactivePlanPopover(null);
    } catch (error) {
      toast.error("Failed to restore plan");
      console.error("Failed to restore plan:", error);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!inactivePlanPopover) return;

    try {
      await deletePlan(inactivePlanPopover.id!);
      setShowDeleteConfirm(false);
      setInactivePlanPopover(null);
    } catch (error) {
      toast.error("Failed to delete plan");
      console.error("Failed to delete plan:", error);
    }
  };

  const hasExpiredOrArchivedPlans = orderedPlans.some((plan) => isPlanExpired(plan) || isPlanArchived(plan));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-6">
        <AnimatePresence mode="popLayout">
          {displayedPlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                layout: { type: "spring", stiffness: 350, damping: 25 },
                opacity: { duration: 0.2 },
                delay: isPlanExpired(plan) && !showOldPlans ? 0 : index * 0.03
              }}
            >
              <PlanCard
                plan={plan}
                isSelected={activeSelectedPlanId === plan.id}
                isLoading={
                  activeSelectedPlanId === plan.id &&
                  (settlingPlanId === plan.id || isFetchingPlans)
                }
                onSelect={handlePlanSelect}
                onInactivePlanClick={handleInactivePlanClick}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <Button
          variant="outline"
          className="bg-muted/50 w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 text-muted-foreground"
          onClick={handleCreatePlanClick}
        >
          <Plus className="h-12 w-12 my-1 text-muted-foreground/70" />
        </Button>
      </div>

      {hasExpiredOrArchivedPlans && !showOldPlans && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOldPlans(true)}
            className="text-muted-foreground"
          >
            Show old & archived plans
          </Button>
        </div>
      )}

      {showOldPlans && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOldPlans(false)}
            className="text-muted-foreground"
          >
            Hide old & archived plans
          </Button>
        </div>
      )}

      {selectedPlan && (
        <>
          <Divider />
          <PlanRendererv2
            key={selectedPlan.id}
            selectedPlan={selectedPlan as CompletePlan}
            scrollTo={scrollTo}
          />
        </>
      )}

      <AppleLikePopover
        open={inactivePlanPopover !== null}
        onClose={() => setInactivePlanPopover(null)}
        title="Manage Plan"
      >
        {inactivePlanPopover && (() => {
          const isExpired = isPlanExpired(inactivePlanPopover);
          const isArchived = isPlanArchived(inactivePlanPopover);
          const statusText = isArchived && isExpired
            ? "This plan is archived and expired"
            : isArchived
              ? "This plan is archived"
              : "This plan has expired";

          return (
            <div className="py-6 space-y-4">
              <div className="text-center mb-6">
                <div className="text-6xl mb-3">
                  {inactivePlanPopover?.emoji || "📋"}
                </div>
                <h3 className="text-lg font-semibold">
                  {inactivePlanPopover?.goal}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusText}
                </p>
              </div>

              <div className="space-y-3">
                {isArchived ? (
                  <Button
                    onClick={handleUnarchive}
                    disabled={isUnarchivingPlan}
                    className="w-full"
                    size="lg"
                  >
                    <ArchiveRestore
                      className={`h-4 w-4 mr-2 ${isUnarchivingPlan ? "animate-spin" : ""}`}
                    />
                    Restore Plan
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleReactivate}
                      disabled={isReactivating}
                      className="w-full"
                      size="lg"
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${isReactivating ? "animate-spin" : ""}`}
                      />
                      Reactivate Plan
                    </Button>

                    <Button
                      onClick={handleArchive}
                      disabled={isArchivingPlan}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive Plan
                    </Button>
                  </>
                )}

                <Button
                  onClick={handleDeleteClick}
                  disabled={isReactivating || isArchivingPlan || isUnarchivingPlan}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Plan
                </Button>
              </div>
            </div>
          );
        })()}
      </AppleLikePopover>

      <ConfirmDialogOrPopover
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title={
          <div className="flex items-center justify-center gap-2">
            <Trash2 className="h-6 w-6 text-red-400" /> Delete Plan
          </div>
        }
        description="Are you sure you want to delete this plan? This action cannot be undone."
        confirmText="Delete Plan"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Plan Limit Popover */}
      <AppleLikePopover
        open={showPlanLimitPopover}
        onClose={() => setShowPlanLimitPopover(false)}
      >
        <div className="flex flex-col items-start justify-center p-4">
          <h1 className="text-2xl font-bold mb-8 mt-2">Create New Plan</h1>
          <span
            className={twMerge(
              "text-3xl font-cursive flex items-center gap-2 my-3",
              userPaidPlanType === "FREE"
                ? "text-gray-500"
                : userPaidPlanType === "PLUS"
                ? "text-blue-500"
                : "text-indigo-500"
            )}
          >
            On {capitalize(userPaidPlanType || "FREE")} Plan
          </span>
          <p className="mb-5">
            You have reached the maximum number of plans for your account.
          </p>
          <Button
            className="w-full"
            onClick={() => {
              setShowPlanLimitPopover(false);
              setShowUpgradePopover(true);
            }}
          >
            Upgrade
          </Button>
        </div>
      </AppleLikePopover>
    </div>
  );
};

export default PlansRenderer;
