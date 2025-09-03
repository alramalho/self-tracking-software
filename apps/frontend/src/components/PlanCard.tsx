import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CompletePlan, usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { BadgeCheck, GripHorizontal, Pencil, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import InviteButton from "./InviteButton";
import { PlanEditModal } from "./PlanEditModal";

interface PlanCardProps {
  plan: CompletePlan;
  isSelected: boolean;
  onSelect: (planId: string) => void;
  onInviteSuccess: () => void;
  hideInviteButton?: boolean;
  onPlanRemoved?: () => void;
  priority?: number;
  isDragging?: boolean;
  dragHandleProps?: Record<string, any>;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isSelected,
  onSelect,
  onInviteSuccess,
  hideInviteButton = false,
  priority,
  isDragging = false,
  dragHandleProps,
}) => {
  const { plans, upsertPlan } = usePlans();
  const { isUserPremium } = usePaidPlan();
  const { currentUser } = useCurrentUser();
  const isCoached =
    isUserPremium &&
    plans?.find(
      (p) =>
        p.sortOrder === Math.min(...plans.map((p) => p.sortOrder ?? Infinity))
    )?.id === plan.id;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    console.log({ isCoached });
  }, [isCoached]);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeletePlan = async () => {
    await upsertPlan({ planId: plan.id!, updates: { deletedAt: new Date() } });
  };

  return (
    <>
      <div
        className={twMerge(
          "relative transition-transform touch-manipulation",
          isDragging && "scale-105 shadow-lg z-50 bg-white rounded-lg"
        )}
        data-testid="plan-card"
        onClick={() => onSelect(plan.id!)}
      >
        {priority !== undefined && (
          <div className="absolute bottom-2 right-2 z-10">
            <Badge
              variant="secondary"
              className={`text-6xl font-normal bg-transparent ${
                isSelected
                  ? `${variants.veryFadedText} hover:${variants.veryFadedText}`
                  : `text-gray-200 hover:text-gray-200`
              } hover:bg-transparent`}
            >
              #{priority}
            </Badge>
          </div>
        )}
        <div
          className="absolute bottom-2 right-[50%] translate-x-[50%] z-10 text-gray-300 cursor-grab active:cursor-grabbing"
          {...dragHandleProps}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-6 w-6" />
          </div>
        </div>
        <div
          className={`flex flex-col items-left justify-center p-4 pr-20 rounded-lg ring-2 ${
            isSelected
              ? twMerge(variants.ringBright, variants.veryFadedBg)
              : cn("ring-gray-300 bg-white")
          } sm:aspect-square w-full relative`}
        >
          {plan.emoji && (
            <span className="text-4xl mb-2 text-left">{plan.emoji}</span>
          )}
          <span className="text-md font-medium text-left">{plan.goal}</span>
          {plan.finishingDate ? (
            <span className="text-xs text-gray-500 text-left mt-1">
              until{" "}
              {plan.finishingDate
                ? new Date(plan.finishingDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : ""}
            </span>
          ) : (
            <span className="text-xs text-gray-500 text-left mt-1">
              no end date
            </span>
          )}
          {plan.planGroup?.members && (
            <div className="flex items-center space-x-1 mt-2">
              {plan.planGroup.members.map((member) => {
                if (!currentUser?.id || member.id === currentUser?.id) {
                  return null;
                }
                return (
                  <Avatar key={member.id} className="w-6 h-6">
                    <AvatarImage
                      src={member.picture || ""}
                      alt={member.name || member.username || ""}
                    />
                    <AvatarFallback>
                      {member.name?.[0] || member.username?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
            </div>
          )}
        </div>

        <div className="absolute top-2 right-2 flex gap-1 items-center justify-end">
          {isCoached && (
            <div className="flex items-center justify-center gap-1 mr-2">
              <span className="text-xs text-gray-500">Coached</span>
              <BadgeCheck className={cn("h-4 w-4", variants.text)} />
            </div>
          )}
          {!hideInviteButton && (
            <InviteButton planId={plan.id!} onInviteSuccess={onInviteSuccess} />
          )}
          <button
            data-testid="plan-edit-button"
            onClick={handleEditClick}
            className="text-gray-500 hover:text-gray-700"
          >
            <Pencil className="h-4 w-4 mr-1" />
          </button>
          <button
            data-testid="plan-delete-button"
            onClick={handleDeleteClick}
            className="text-red-400 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmDialogOrPopover
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePlan}
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

      <PlanEditModal
        plan={plan}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => setShowEditModal(false)}
      />
    </>
  );
};

export default PlanCard;
