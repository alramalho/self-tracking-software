import React, { useState, useEffect } from "react";
import { CompletePlan, useUserPlan } from "@/contexts/UserGlobalContext";
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Plus, PlusSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Activity, Plan, PlanGroup, PlanSession } from "@prisma/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PlanCard from "./PlanCard";
import { useRouter } from "next/navigation";
import Divider from "./Divider";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { parseISO, format, addMonths, isBefore } from "date-fns";

// Helper function to check if a plan is expired
export const isPlanExpired = (plan: Plan): boolean => {
  if (!plan.finishingDate) return false;
  return isBefore(plan. finishingDate, new Date());
};

// Function to sort plans with active plans first, then expired plans
const sortPlansByExpiration = (plans: Plan[]): Plan[] => {
  // Create a copy to avoid mutating the original array
  return [...plans].sort((a, b) => {
    const aExpired = isPlanExpired(a);
    const bExpired = isPlanExpired(b);

    if (aExpired && !bExpired) return 1; // a is expired, b is not, so b comes first
    if (!aExpired && bExpired) return -1; // a is not expired, b is, so a comes first
    return 0; // both are either expired or not expired, maintain original order
  });
};

interface SortablePlanProps {
  plan: Plan;
  planGroup?: PlanGroup;
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
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery, refetchUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialSelectedPlanId || null
  );
  const [orderedPlans, setOrderedPlans] = useState<Plan[]>([]);

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
      // Sort plans with active plans first, then expired plans
      setOrderedPlans(sortPlansByExpiration(userData.plans));
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
      await api.post(`/plans/${planId}/update`, {
        data: {
          finishingDate: oneMonthLater,
        },
      });
      await refetchUserData(false);
      toast.success("Plan reactivated successfully");
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

  const getPlanGroup = (planId: string): PlanGroup | undefined => {
    return plans.find((p) => p.id === planId)?.planGroup || undefined;
  };

  const handleInviteSuccess = () => {
    refetchUserData();
  };

  const handlePlanRemoved = () => {
    refetchUserData();
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
      await api.post("/plans/update-plan-order", {
        plan_ids: items.map((plan) => plan.id),
      });
      currentUserDataQuery.refetch();
      toast.success("Plan priority updated");
    } catch (error) {
      toast.error("Failed to update plan priority");
      console.error("Failed to update plan priority:", error);
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
