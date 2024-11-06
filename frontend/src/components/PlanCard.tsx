import React from "react";
import { ApiPlan, PlanGroup } from "@/contexts/UserPlanContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import InviteButton from "./InviteButton";

interface PlanCardProps {
  plan: ApiPlan;
  planGroup?: PlanGroup;
  isSelected: boolean;
  currentUserId?: string;
  onSelect: (planId: string) => void;
  onInviteSuccess: () => void;
  hideInviteButton?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  planGroup,
  isSelected,
  currentUserId,
  onSelect,
  onInviteSuccess,
  hideInviteButton = false,
}) => {
  return (
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
        {!hideInviteButton && (
          <InviteButton planId={plan.id!} onInviteSuccess={onInviteSuccess} />
        )}
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
  );
};

export default PlanCard; 