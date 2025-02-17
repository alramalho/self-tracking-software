import React, { useState } from "react";
import { ApiPlan, PlanGroup, useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import InviteButton from "./InviteButton";
import { Settings, GripVertical, GripHorizontal } from "lucide-react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import ConfirmDialog from "./ConfirmDialog";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { twMerge } from "tailwind-merge";
import { usePlanEdit } from "@/hooks/usePlanEdit";
import { PlanEditModal } from "./PlanEditModal";

interface PlanCardProps {
  plan: ApiPlan;
  planGroup?: PlanGroup;
  isSelected: boolean;
  currentUserId?: string;
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
  planGroup,
  isSelected,
  currentUserId,
  onSelect,
  onInviteSuccess,
  hideInviteButton = false,
  onPlanRemoved,
  priority,
  isDragging = false,
  dragHandleProps,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const api = useApiWithAuth();
  const { showEditModal, setShowEditModal, handleEditPlan } = usePlanEdit();

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(true);
  };

  const handleLeavePlan = async () => {
    toast.promise(
      api.post(`/plans/${plan.id}/leave`).then(() => {
        setShowSettings(false);
        setShowLeaveConfirm(false);
        onPlanRemoved?.();
      }),
      {
        loading: "Leaving plan...",
        success: "You have left the plan",
        error: "Failed to leave plan",
      }
    );
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
          className={`flex flex-col items-left justify-center p-4 pr-20 rounded-lg border-2 ${
            isSelected
              ? twMerge(
                  variants.card.selected.border,
                  variants.card.selected.bg
                )
              : "border-gray-300 bg-white"
          } sm:aspect-square w-full relative`}
        >
          {plan.emoji && (
            <span className="text-4xl mb-2 text-left">{plan.emoji}</span>
          )}
          <span className="text-md font-medium text-left">{plan.goal}</span>
          {plan.finishing_date ? (
            <span className="text-xs text-gray-500 text-left mt-1">
              until{" "}
              {plan.finishing_date
                ? new Date(plan.finishing_date).toLocaleDateString("en-GB", {
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
          {planGroup && planGroup.members && (
            <div className="flex items-center space-x-1 mt-2">
              {planGroup.members.map((member) => {
                if (!currentUserId || member.user_id === currentUserId) {
                  return null;
                }
                return (
                  <Avatar key={member.user_id} className="w-6 h-6">
                    <AvatarImage
                      src={member.picture || ""}
                      alt={member.name || member.username}
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

        <div className="absolute top-2 right-2 flex gap-2">
          {!hideInviteButton && (
            <InviteButton planId={plan.id!} onInviteSuccess={onInviteSuccess} />
          )}
          <button
            data-testid="plan-settings-button"
            onClick={handleSettingsClick}
            className="p-1"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AppleLikePopover
        open={showSettings}
        onClose={() => setShowSettings(false)}
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold mb-4">Plan Settings</h2>
          <Button
            variant="outline"
            onClick={() => {
              setShowSettings(false);
              setShowEditModal(true);
            }}
            className="w-full"
          >
            Edit Plan
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setShowSettings(false);
              setShowLeaveConfirm(true);
            }}
            className="w-full"
          >
            Leave Plan
          </Button>
        </div>
      </AppleLikePopover>

      <ConfirmDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeavePlan}
        title="Leave Plan"
        description="Are you sure you want to leave this plan? This action cannot be undone."
        confirmText="Leave Plan"
        cancelText="Cancel"
        variant="destructive"
      />

      <PlanEditModal
        plan={plan}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onConfirm={(updatedPlan) => handleEditPlan(plan, updatedPlan)}
      />
    </>
  );
};

export default PlanCard;
