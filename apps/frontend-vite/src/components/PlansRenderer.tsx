
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { Link } from "@tanstack/react-router";
import { addMonths, isBefore } from "date-fns";
import { BadgeCheck, Plus, PlusSquare, RefreshCw, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import Divider from "./Divider";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";
import { useCurrentUser } from "@/contexts/users";
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

// Function to sort plans: coached first, then by creation date (newest first)
const sortPlansByDate = (plans: CompletePlan[]): CompletePlan[] => {
  return [...plans].sort((a, b) => {
    // Coached plans always come first
    if (a.isCoached && !b.isCoached) return -1;
    if (!a.isCoached && b.isCoached) return 1;

    // If both are coached or both are not coached, sort by creation date
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

interface PlanCardProps {
  plan: CompletePlan;
  isSelected: boolean;
  onSelect: (planId: string) => void;
  onExpiredPlanClick?: (plan: CompletePlan) => void;
  isCoached?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isSelected,
  onSelect,
  onExpiredPlanClick,
  isCoached = false,
}) => {
  const isExpired = isPlanExpired(plan);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const handleCardClick = () => {
    if (isExpired && onExpiredPlanClick) {
      onExpiredPlanClick(plan);
    } else {
      onSelect(plan.id!);
    }
  };

  return (
    <div className="relative">
      {isCoached && (
        <div className="absolute top-1 right-1 z-10 flex bg-transparent">
          <BadgeCheck className={`h-4 w-4 ${variants.fadedText}`} />
        </div>
      )}
      <div
        className={`flex items-center justify-center h-20 rounded-lg ring-2 bg-card cursor-pointer transition-all ${
          isSelected
            ? `${variants.ringBright} ${variants.veryFadedBg}`
            : "ring-border hover:ring-muted-foreground/50"
        }`}
        onClick={handleCardClick}
        style={{ opacity: isExpired ? 0.5 : 1 }}
      >
        {plan.emoji ? (
          <span className="text-5xl">{plan.emoji}</span>
        ) : (
          <span className="text-xl text-muted-foreground font-medium">
            {plan.goal.substring(0, 2).toUpperCase()}
          </span>
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
  const { plans, isLoadingPlans, upsertPlan, deletePlan } = usePlans();
  const { currentUser } = useCurrentUser();
  const { maxPlans, userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialSelectedPlanId || null
  );
  const [orderedPlans, setOrderedPlans] = useState<CompletePlan[]>([]);
  const [showOldPlans, setShowOldPlans] = useState(false);
  const [expiredPlanPopover, setExpiredPlanPopover] = useState<CompletePlan | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [showCreatePlanPopover, setShowCreatePlanPopover] = useState(false);
  const [showPlanLimitPopover, setShowPlanLimitPopover] = useState(false);

  useEffect(() => {
    if (plans) {
      // Sort plans by creation date
      setOrderedPlans(sortPlansByDate(plans as CompletePlan[]));
    }
  }, [plans]);

  useEffect(() => {
    if (
      initialSelectedPlanId &&
      orderedPlans.some((plan) => plan.id === initialSelectedPlanId)
    ) {
      setSelectedPlanId(initialSelectedPlanId);
    } else if (!initialSelectedPlanId && orderedPlans.length > 0 && !selectedPlanId) {
      // If no initial plan is selected, default to coached plan or first non-expired plan
      const coachedPlan = orderedPlans.find(plan => plan.isCoached && !isPlanExpired(plan));
      const firstNonExpiredPlan = orderedPlans.find(plan => !isPlanExpired(plan));
      const defaultPlan = coachedPlan || firstNonExpiredPlan || orderedPlans[0];
      setSelectedPlanId(defaultPlan.id!);
    }
  }, [orderedPlans, initialSelectedPlanId, selectedPlanId]);

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
      setShowCreatePlanPopover(true);
    }
  };

  const handleCreatePlanSuccess = () => {
    setShowCreatePlanPopover(false);
    toast.success("Plan created successfully!");
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

        {/* Create Plan Popover */}
        <AppleLikePopover
          open={showCreatePlanPopover}
          onClose={() => setShowCreatePlanPopover(false)}
          title="Create New Plan"
        >
          <div className="text-center mb-6 mt-4">
            <div className="text-6xl mb-3">
              🎯
            </div>
            <h3 className="text-lg font-semibold">
              Create Your New Plan
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Set up a new plan to track your goals and activities
            </p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <PlanConfigurationForm
              onSuccess={handleCreatePlanSuccess}
              onClose={() => setShowCreatePlanPopover(false)}
              title={`${currentUser?.name}'s New Plan`}
            />
          </div>
        </AppleLikePopover>

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
    if (selectedPlanId === planId) {
      setSelectedPlanId(null);
    } else {
      setSelectedPlanId(planId);
    }
  };

  const handleExpiredPlanClick = (plan: CompletePlan) => {
    setExpiredPlanPopover(plan);
  };

  const handleReactivate = async () => {
    if (!expiredPlanPopover || isReactivating) return;

    setIsReactivating(true);
    try {
      const oneMonthLater = addMonths(new Date(), 1);
      await upsertPlan({
        planId: expiredPlanPopover.id!,
        updates: { finishingDate: oneMonthLater }
      });
      toast.success("Plan reactivated");
      setExpiredPlanPopover(null);
    } catch (error) {
      toast.error("Failed to reactivate plan");
      console.error("Failed to reactivate plan:", error);
    } finally {
      setIsReactivating(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!expiredPlanPopover) return;

    try {
      await deletePlan(expiredPlanPopover.id!);
      setShowDeleteConfirm(false);
      setExpiredPlanPopover(null);
    } catch (error) {
      toast.error("Failed to delete plan");
      console.error("Failed to delete plan:", error);
    }
  };

  // Filter plans based on whether we're showing old plans
  const displayedPlans = showOldPlans
    ? orderedPlans
    : orderedPlans.filter((plan) => !isPlanExpired(plan));

  const hasExpiredPlans = orderedPlans.some((plan) => isPlanExpired(plan));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-6">
        <AnimatePresence mode="popLayout">
          {displayedPlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                layout: { type: "spring", stiffness: 350, damping: 25 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
                delay: isPlanExpired(plan) && !showOldPlans ? 0 : index * 0.03
              }}
            >
              <PlanCard
                plan={plan}
                isSelected={selectedPlanId === plan.id}
                onSelect={handlePlanSelect}
                onExpiredPlanClick={handleExpiredPlanClick}
                isCoached={plan.isCoached}
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

      {hasExpiredPlans && !showOldPlans && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOldPlans(true)}
            className="text-muted-foreground"
          >
            Show old plans
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
            Hide old plans
          </Button>
        </div>
      )}

      <Divider />

      <AnimatePresence mode="wait">
        {selectedPlanId && orderedPlans.find((p) => p.id === selectedPlanId) && (
          <PlanRendererv2
            key={selectedPlanId}
            selectedPlan={
              orderedPlans.find((p) => p.id === selectedPlanId)! as CompletePlan
            }
            scrollTo={scrollTo}
          />
        )}
      </AnimatePresence>

      <AppleLikePopover
        open={expiredPlanPopover !== null}
        onClose={() => setExpiredPlanPopover(null)}
        title="Manage Plan"
      >
        <div className="py-6 space-y-4">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">
              {expiredPlanPopover?.emoji || "📋"}
            </div>
            <h3 className="text-lg font-semibold">
              {expiredPlanPopover?.goal}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              This plan has expired
            </p>
          </div>

          <div className="space-y-3">
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
              onClick={handleDeleteClick}
              disabled={isReactivating}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Plan
            </Button>
          </div>
        </div>
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

      {/* Create Plan Popover */}
      <AppleLikePopover
        open={showCreatePlanPopover}
        onClose={() => setShowCreatePlanPopover(false)}
        title="Create New Plan"
      >
        <div className="text-center mb-6 mt-4">
          <div className="text-6xl mb-3">
            🎯
          </div>
          <h3 className="text-lg font-semibold">
            Create Your New Plan
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Set up a new plan to track your goals and activities
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <PlanConfigurationForm
            onSuccess={handleCreatePlanSuccess}
            onClose={() => setShowCreatePlanPopover(false)}
            title={`${currentUser?.name}'s New Plan`}
          />
        </div>
      </AppleLikePopover>

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