import React, { useState } from "react";
import { ApiPlan, PlanGroup, useUserPlan } from "@/contexts/UserPlanContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import InviteButton from "./InviteButton";
import { Settings } from "lucide-react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import PlanEditStep from "./PlanEditStep";
import ConfirmDialog from "./ConfirmDialog";

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

  return (
    <>
      <div
        className={`flex flex-col p-6 rounded-lg border-2 cursor-pointer hover:bg-gray-50 ${
          isSelected ? "border-blue-500" : "border-gray-200"
        }`}
        onClick={() => onSelect(plan.id!)}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            {plan.emoji && <span className="text-4xl mr-2">{plan.emoji}</span>}
            <span className="text-xl font-medium">{plan.goal}</span>
          </div>
          <div className="flex items-center gap-2">
            {!hideInviteButton && (
              <InviteButton
                planId={plan.id!}
                onInviteSuccess={onInviteSuccess}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSettingsClick}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <span className="text-sm text-gray-500 mb-4">
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
          <div className="flex items-center space-x-2">
            {planGroup.members.map((member) => {
              if (!currentUserId || member.user_id === currentUserId) {
                return null;
              }
              return (
                <Avatar key={member.user_id} className="w-8 h-8">
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

      {showSettings && (
        <AppleLikePopover onClose={() => setShowSettings(false)}>
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold mb-4">Plan Settings</h2>
            {/* <Button
              variant="outline"
              onClick={() => {
                setShowSettings(false);
                setShowEditModal(true);
              }}
              className="w-full"
            >
              Edit Plan
            </Button> */}
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
      )}

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

      {showEditModal && (
        <AppleLikePopover onClose={() => setShowEditModal(false)}>
          <PlanEditStep
            plan={plan}
            onClose={() => setShowEditModal(false)}
            onPlanUpdated={() => {
              setShowEditModal(false);
              onPlanRemoved?.();
            }}
          />
        </AppleLikePopover>
      )}
    </>
  );
};

export default PlanCard;
