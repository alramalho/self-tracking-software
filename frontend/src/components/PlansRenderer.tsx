import React, { useState, useEffect } from "react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { PlanRendererv2 } from "@/components/PlanRendererv2";
import { Button } from "@/components/ui/button";
import { Plus, PlusSquare } from "lucide-react";
import Link from "next/link";
import { ApiPlan, PlanGroup } from "@/contexts/UserPlanContext";
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

interface SortablePlanProps {
  plan: ApiPlan;
  planGroup?: PlanGroup;
  isSelected: boolean;
  currentUserId?: string;
  onSelect: (planId: string) => void;
  onInviteSuccess: () => void;
  onPlanRemoved?: () => void;
  priority: number;
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
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plan.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    touchAction: isDragging ? 'none' as const : 'pan-y' as const,
  };

  return (
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
  );
};

const PlansRenderer: React.FC = () => {
  const router = useRouter();
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery, refetchUserData } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [orderedPlans, setOrderedPlans] = useState<ApiPlan[]>([]);

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
      setOrderedPlans(userData.plans);
    }
  }, [userData?.plans]);

  useEffect(() => {
    if (!selectedPlanId && orderedPlans && orderedPlans.length > 0) {
      const firstPlan = orderedPlans[0];
      setSelectedPlanId(firstPlan.id || null);
    }
  }, [orderedPlans]);

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

  const { planGroups = [] } = userData!;

  const getPlanGroup = (planId: string): PlanGroup | undefined => {
    return planGroups.find((group) => group.plan_ids.includes(planId));
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
        plan_ids: items.map(plan => plan.id),
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
            items={orderedPlans.map(plan => plan.id!)}
            strategy={verticalListSortingStrategy}
          >
            {orderedPlans.map((plan, index) => (
              <SortablePlan
                key={plan.id}
                plan={plan}
                planGroup={getPlanGroup(plan.id!)}
                isSelected={selectedPlanId === plan.id}
                currentUserId={userData?.user?.id}
                onSelect={handlePlanSelect}
                onInviteSuccess={handleInviteSuccess}
                onPlanRemoved={handlePlanRemoved}
                priority={index + 1}
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
          selectedPlan={orderedPlans.find((p) => p.id === selectedPlanId)!}
        />
      )}
    </div>
  );
};

export default PlansRenderer;
