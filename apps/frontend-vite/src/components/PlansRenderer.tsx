
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { addMonths, isBefore } from "date-fns";
import { Plus, PlusSquare, RefreshCw, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import Divider from "./Divider";
import AppleLikePopover from "./AppleLikePopover";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";

// Helper function to check if a plan is expired
export const isPlanExpired = (plan: {
  finishingDate: Date | null;
}): boolean => {
  if (!plan.finishingDate) return false;
  return isBefore(plan.finishingDate, new Date());
};

// Function to sort plans by sortOrder field, with fallback to creation date
const sortPlansByOrder = (plans: CompletePlan[]): CompletePlan[] => {
  return [...plans].sort((a, b) => {
    // If both have sortOrder, use that
    if (a.sortOrder !== null && b.sortOrder !== null) {
      return a.sortOrder - b.sortOrder;
    }
    // If only one has sortOrder, prioritize it
    if (a.sortOrder !== null && b.sortOrder === null) return -1;
    if (a.sortOrder === null && b.sortOrder !== null) return 1;
    // If neither has sortOrder, fall back to creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

interface SortablePlanProps {
  plan: CompletePlan;
  isSelected: boolean;
  currentUserId?: string;
  onSelect: (planId: string) => void;
  onInviteSuccess: () => void;
  priority: number;
  onExpiredPlanClick?: (plan: CompletePlan) => void;
}

const SortablePlan: React.FC<SortablePlanProps> = ({
  plan,
  isSelected,
  onSelect,
  onInviteSuccess,
  priority,
  onExpiredPlanClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plan.id! });

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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
    touchAction: isDragging ? ("none" as const) : ("pan-y" as const),
    opacity: isExpired ? 0.5 : 1,
    position: "relative" as const,
  };

  return (
    <div className="relative">
      <motion.div
        ref={setNodeRef}
        style={style}
        layout
        initial={false}
        transition={{
          layout: { duration: 0.3, ease: "easeInOut" },
        }}
      >
        <div
          className={`flex items-center justify-center h-20 rounded-lg ring-2 bg-card cursor-pointer transition-all ${
            isSelected
              ? `${variants.ringBright} ${variants.veryFadedBg}`
              : "ring-border hover:ring-muted-foreground/50"
          }`}
          onClick={handleCardClick}
          {...attributes}
          {...listeners}
        >
          {plan.emoji ? (
            <span className="text-5xl">{plan.emoji}</span>
          ) : (
            <span className="text-xl text-muted-foreground font-medium">
              {plan.goal.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
};

interface PlansRendererProps {
  initialSelectedPlanId?: string | null;
}

const PlansRenderer: React.FC<PlansRendererProps> = ({
  initialSelectedPlanId,
}) => {
  const { plans, updatePlans, isLoadingPlans, upsertPlan, deletePlan } = usePlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialSelectedPlanId || null
  );
  const [orderedPlans, setOrderedPlans] = useState<CompletePlan[]>([]);
  const [showOldPlans, setShowOldPlans] = useState(false);
  const [expiredPlanPopover, setExpiredPlanPopover] = useState<CompletePlan | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  useEffect(() => {
    if (plans) {
      // Sort plans by sortOrder field
      setOrderedPlans(sortPlansByOrder(plans as CompletePlan[]));
    }
  }, [plans]);

  useEffect(() => {
    if (
      initialSelectedPlanId &&
      orderedPlans.some((plan) => plan.id === initialSelectedPlanId)
    ) {
      setSelectedPlanId(initialSelectedPlanId);
    }
  }, [orderedPlans, initialSelectedPlanId]);

  if (isLoadingPlans) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (plans && plans.length === 0) {
    return (
      <>
        <Link to="/create-new-plan">
          <Button
            variant="outline"
            className="bg-muted/50 w-full h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-border text-muted-foreground"
          >
            <PlusSquare className="h-8 w-8 mb-2 text-muted-foreground/70" />
            <span>Create new Plan</span>
          </Button>
        </Link>
      </>
    );
  }

  const getPlanGroup = (
    planId: string
  ): CompletePlan["planGroup"] | undefined => {
    return plans?.find((p) => p.id === planId)?.planGroup || undefined;
  };

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedPlans.findIndex((plan) => plan.id === active.id);
    const newIndex = orderedPlans.findIndex((plan) => plan.id === over.id);

    const items = Array.from(orderedPlans);
    const [reorderedItem] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, reorderedItem);

    setOrderedPlans(items);

    try {
      // Update sortOrder for each plan based on new positions
      const updates = items.map((plan, index) => ({
        planId: plan.id!,
        updates: { sortOrder: index + 1 },
      }));

      const result = await updatePlans({ updates, muteNotifications: true });

      if (result.success) {
        toast.success("Plan priority updated");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error("Failed to update plan priority");
      console.error("Failed to update plan priority:", error);
      // Revert the local state change
      setOrderedPlans(
        sortPlansByOrder((plans as CompletePlan[]) || [])
      );
    }
  };

  // Filter plans based on whether we're showing old plans
  const displayedPlans = showOldPlans
    ? orderedPlans
    : orderedPlans.filter((plan) => !isPlanExpired(plan));

  const hasExpiredPlans = orderedPlans.some((plan) => isPlanExpired(plan));

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
      >
        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-6">
          <SortableContext
            items={displayedPlans.map((plan) => plan.id!)}
            strategy={verticalListSortingStrategy}
          >
            {displayedPlans.map((plan, index) => (
              <SortablePlan
                key={plan.id}
                plan={plan}
                isSelected={selectedPlanId === plan.id}
                onSelect={handlePlanSelect}
                onInviteSuccess={() => {}}
                priority={index + 1}
                onExpiredPlanClick={handleExpiredPlanClick}
              />
            ))}
          </SortableContext>
          <Link to="/create-new-plan">
            <Button
              variant="outline"
              className="bg-muted/50 w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 text-muted-foreground"
            >
              <Plus className="h-12 w-12 my-1 text-muted-foreground/70" />
            </Button>
          </Link>
        </div>
      </DndContext>

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

      {selectedPlanId && orderedPlans.find((p) => p.id === selectedPlanId) && (
        <PlanRendererv2
          selectedPlan={
            orderedPlans.find((p) => p.id === selectedPlanId)! as CompletePlan
          }
        />
      )}

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
    </div>
  );
};

export default PlansRenderer;