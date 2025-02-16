import React, { useEffect, useState } from "react";
import { ApiPlan, PlanGroup, useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import InviteButton from "./InviteButton";
import { Edit, Settings } from "lucide-react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import ConfirmDialog from "./ConfirmDialog";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants, ThemeColor } from "@/utils/theme";
import { twMerge } from "tailwind-merge";

interface PlanCardProps {
  plan: ApiPlan;
  planGroup?: PlanGroup;
  isSelected: boolean;
  currentUserId?: string;
  onSelect: (planId: string) => void;
  onInviteSuccess: () => void;
  hideInviteButton?: boolean;
  onPlanRemoved?: () => void;
}

interface UpdatePlanResponse {
  plan: ApiPlan;
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
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  

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

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(true);
  };

  const handleEditPlan = async (updatedPlan: ApiPlan) => {
    try {
      const response = await api.post<UpdatePlanResponse>(
        `/plans/${plan.id}/update`,
        {
          data: updatedPlan,
        }
      );
      currentUserDataQuery.refetch();
      setShowEditModal(false);
      toast.success("Plan updated successfully");
    } catch (error) {
      console.error("Failed to update plan:", error);
      toast.error("Failed to update plan");
    }
  };

  return (
    <>
      <div className="relative" data-testid="plan-card">
        <button
          onClick={() => onSelect(plan.id!)}
          className={`flex flex-col items-left justify-center p-4 rounded-lg border-2 ${
            isSelected
              ? twMerge(
                  variants.card.selected.border,
                  variants.card.selected.bg
                )
              : "border-gray-300 bg-white"
          } aspect-square w-full`}
        >
          {plan.emoji && (
            <span className="text-2xl mb-2 text-left">{plan.emoji}</span>
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
        </button>

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

      <AppleLikePopover
        className={"bg-gray-50"}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
      >
        <PlanConfigurationForm
          isEdit={true}
          plan={plan}
          title={plan.goal}
          onClose={() => setShowEditModal(false)}
          onConfirm={handleEditPlan}
        />
      </AppleLikePopover>
    </>
  );
};

export default PlanCard;
