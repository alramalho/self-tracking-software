import { updatePlans } from "@/app/actions";
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { CompletePlan, useUserPlan } from "@/contexts/UserGlobalContext";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addMonths, format, isBefore } from "date-fns";
import { Plus, PlusSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Divider from "./Divider";
import PlanCard from "./PlanCard";

// Helper function to check if a plan is expired
export const isPlanExpired = (plan: {finishingDate: Date | null}): boolean => {
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
  planGroup?: CompletePlan["planGroup"];
  isSelected: boolean;
  currentUserId?: string;
  onSelect: (planId: string) => void;
  onInviteSuccess: () => void;
  onPlanRemoved?: () => void;
  priority: number;
  onReactivate: (planId: string) => Promise<void>;
}

const SortablePlan: React.FC<SortablePlanProps> = ({
  plan,
  planGroup,
  isSelected,
  currentUserId,
  onSelect,
  onInviteSuccess,
  onPlanRemoved,
  priority,
  onReactivate,
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
  const [isReactivating, setIsReactivating] = useState(false);

  const handleReactivate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReactivating) return;

    setIsReactivating(true);
    try {
      await onReactivate(plan.id!);
    } finally {
      setIsReactivating(false);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    userSelect: "none" as const,
    WebkitUserSelect: "none" as const,
    touchAction: isDragging ? ("none" as const) : ("pan-y" as const),
    opacity: isExpired ? 0.35 : 1,
    position: "relative" as const,
  };

  return (
    <div className="relative">
      <div ref={setNodeRef} style={style}>
        <PlanCard
          plan={plan}
          planGroup={planGroup}
          isSelected={isSelected}
          currentUserId={currentUserId}
          onSelect={onSelect}
          onInviteSuccess={onInviteSuccess}
          onPlanRemoved={onPlanRemoved}
          priority={priority}
          isDragging={isDragging}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </div>
      {isExpired && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="secondary"
            className="font-medium border-2"
            onClick={handleReactivate}
            disabled={isReactivating}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isReactivating ? "animate-spin" : ""}`}
            />
            Reactivate
          </Button>
        </div>
      )}
    </div>
  );
};

interface PlansRendererProps {
  initialSelectedPlanId?: string | null;
}

const PlansRenderer: React.FC<PlansRendererProps> = ({
  initialSelectedPlanId,
}) => {
  const { useCurrentUserDataQuery, refetchUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialSelectedPlanId || null
  );
  const [orderedPlans, setOrderedPlans] = useState<CompletePlan[]>([]);

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
    if (userData?.plans) {
      // Sort plans by sortOrder field
      setOrderedPlans(sortPlansByOrder(userData.plans as CompletePlan[]));
    }
  }, [userData?.plans]);

  useEffect(() => {
    if (
      initialSelectedPlanId &&
      orderedPlans.some((plan) => plan.id === initialSelectedPlanId)
    ) {
      setSelectedPlanId(initialSelectedPlanId);
    } else if (!selectedPlanId && orderedPlans && orderedPlans.length > 0) {
      const firstPlan = orderedPlans[0];
      setSelectedPlanId(firstPlan.id || null);
    }
  }, [orderedPlans, initialSelectedPlanId]);

  const handleReactivatePlan = async (planId: string) => {
    try {
      const oneMonthLater = format(addMonths(new Date(), 1), "yyyy-MM-dd");
      const result = await updatePlans([{
        planId,
        updates: { finishingDate: oneMonthLater }
      }]);
      
      if (result.success) {
        await refetchUserData(false);
        toast.success("Plan reactivated successfully");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Failed to reactivate plan:", error);
      toast.error("Failed to reactivate plan");
    }
  };

  if (userData?.plans && userData.plans.length === 0) {
    return (
      <>
        <Link href="/create-new-plan" passHref>
          <Button
            variant="outline"
            className="bg-gray-50 w-full h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-500"
          >
            <PlusSquare className="h-8 w-8 mb-2 text-gray-400" />
            <span>Create new Plan</span>
          </Button>
        </Link>
      </>
    );
  }

  const { plans = [] } = userData || {};

  const getPlanGroup = (planId: string): CompletePlan["planGroup"] | undefined => {
    return plans.find((p) => p.id === planId)?.planGroup || undefined;
  };

  const handleInviteSuccess = () => {
    refetchUserData(true);
  };

  const handlePlanRemoved = () => {
    refetchUserData(true);
  };

  const handlePlanSelect = (planId: string) => {
    if (selectedPlanId === planId) {
      setSelectedPlanId(null);
    } else {
      setSelectedPlanId(planId);
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

      const result = await updatePlans(updates);
      
      if (result.success) {
        currentUserDataQuery.refetch();
        toast.success("Plan priority updated");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error("Failed to update plan priority");
      console.error("Failed to update plan priority:", error);
      // Revert the local state change
      setOrderedPlans(sortPlansByOrder(userData?.plans as CompletePlan[] || []));
    }
  };

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <SortableContext
            items={orderedPlans.map((plan) => plan.id!)}
            strategy={verticalListSortingStrategy}
          >
            {orderedPlans.map((plan, index) => (
              <SortablePlan
                key={plan.id}
                plan={plan}
                planGroup={getPlanGroup(plan.id!)}
                isSelected={selectedPlanId === plan.id}
                currentUserId={userData?.id}
                onSelect={handlePlanSelect}
                onInviteSuccess={handleInviteSuccess}
                onPlanRemoved={handlePlanRemoved}
                priority={index + 1}
                onReactivate={handleReactivatePlan}
              />
            ))}
          </SortableContext>
          <Link href="/create-new-plan" passHref>
            <Button
              variant="outline"
              className="bg-gray-50 w-full h-full min-h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-gray-500"
            >
              <Plus className="h-6 w-6 mb-1 text-gray-400" />
              <span className="text-sm">Create New Plan</span>
            </Button>
          </Link>
        </div>
      </DndContext>

      <Divider />

      {selectedPlanId && orderedPlans.find((p) => p.id === selectedPlanId) && (
        <PlanRendererv2
          selectedPlan={
            orderedPlans.find((p) => p.id === selectedPlanId)! as CompletePlan
          }
        />
      )}
    </div>
  );
};

export default PlansRenderer;
