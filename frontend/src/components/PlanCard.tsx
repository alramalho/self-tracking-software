import React, { useEffect, useState } from "react";
import { ApiPlan, PlanGroup, useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import InviteButton from "./InviteButton";
import { Settings } from "lucide-react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import ConfirmDialog from "./ConfirmDialog";
import PlanConfigurationForm from "./plan-configuration/PlanConfigurationForm";

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
  const [showSettings, setShowSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const api = useApiWithAuth();
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");

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
          data: {
            goal: updatedPlan.goal,
            emoji: updatedPlan.emoji,
            duration_type: updatedPlan.duration_type,
            finishing_date: updatedPlan.finishing_date,
            notes: updatedPlan.notes,
            outline_type: updatedPlan.outline_type,
            times_per_week: updatedPlan.times_per_week,
            sessions: updatedPlan.sessions,
            milestones: updatedPlan.milestones,
          },
        }
      );
      userDataQuery.refetch();
      setShowEditModal(false);
      toast.success("Plan updated successfully");
    } catch (error) {
      console.error("Failed to update plan:", error);
      toast.error("Failed to update plan");
    }
  };

  return (
    <>
      <div
        data-testid="plan-card"
        className={`flex flex-col p-4 rounded-lg border-2 cursor-pointer relative 
          ${
            isSelected
              ? "border-blue-500 bg-blue-50"
              : "bg-white border-gray-200"
          } transition-colors duration-200`}
        onClick={() => onSelect(plan.id!)}
      >
        <div className="flex items-start mb-2">
          <div className="flex items-center">
            {plan.emoji && <span className="text-2xl mr-2">{plan.emoji}</span>}
            <span className="text-base font-medium">{plan.goal}</span>
          </div>
        </div>

        <span className="text-xs text-gray-500 mb-2">
          📍{" "}
          {plan.finishing_date
            ? new Date(plan.finishing_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : ""}
        </span>

        {planGroup && planGroup.members && (
          <div className="flex items-center space-x-1">
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

        <div className="absolute top-2 right-3">
          {!hideInviteButton && (
            <InviteButton planId={plan.id!} onInviteSuccess={onInviteSuccess} />
          )}
        </div>
        <div className="absolute bottom-2 right-2">
          <Button
            data-testid="plan-settings-button"
            variant="ghost"
            size="icon"
            onClick={handleSettingsClick}
            className="h-6 w-6"
          >
            <Settings className="h-4 w-4" />
          </Button>
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
