import { useMyCircles } from "@/components/circles/api";
import { PersonAvatar } from "@/components/circles/components";
import { Badge } from "@/components/ui/badge";
import { type CompletePlan, usePlans } from "@/contexts/plans";
import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { GripHorizontal, Pencil, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { twMerge } from "tailwind-merge";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import { useNavigate } from "@tanstack/react-router";

interface PlanCardProps {
  plan: CompletePlan;
  isSelected: boolean;
  onSelect: (planId: string) => void;
  onPlanRemoved?: () => void;
  priority?: number;
  isDragging?: boolean;
  dragHandleProps?: Record<string, any>;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isSelected,
  onSelect,
  priority,
  isDragging = false,
  dragHandleProps,
}) => {
  const { deletePlan } = usePlans();
  // Your own plan's people are its circle now, not a plan group.
  const { data: myCircles } = useMyCircles();
  const circle = myCircles?.find((each) => each.planId === plan.id);
  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/edit-plan/$planId", params: { planId: plan.id! } });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeletePlan = async () => {
    await deletePlan(plan.id!);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div
        className={twMerge(
          "relative transition-transform touch-manipulation",
          isDragging && "scale-105 shadow-lg z-50 bg-card rounded-lg"
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
                  : `text-muted-foreground/20 hover:text-muted-foreground/20`
              } hover:bg-transparent`}
            >
              #{priority}
            </Badge>
          </div>
        )}
        <div
          className="absolute bottom-2 right-[50%] translate-x-[50%] z-10 text-muted-foreground cursor-grab active:cursor-grabbing"
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
              : cn("ring-border bg-card")
          } sm:aspect-square w-full relative`}
        >
          {plan.emoji && (
            <span className="text-4xl mb-2 text-left">{plan.emoji}</span>
          )}
          <span className="text-md font-medium text-left">{plan.goal}</span>
          {plan.finishingDate ? (
            <span className="text-xs text-muted-foreground text-left mt-1">
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
            <span className="text-xs text-muted-foreground text-left mt-1">
              no end date
            </span>
          )}
          {circle && (
            <div className="flex items-center space-x-1 mt-2" aria-label={`${circle.emoji} ${circle.name}`}>
              {circle.people
                .filter((person) => !person.isMe)
                .map((person, index) => (
                  <PersonAvatar
                    key={index}
                    name={person.name}
                    picture={person.picture}
                    size={24}
                  />
                ))}
            </div>
          )}
        </div>

        <div className="absolute top-2 right-2 flex gap-1 items-center justify-end">
          <button
            data-testid="plan-edit-button"
            onClick={handleEditClick}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-5 w-5 mr-1" />
          </button>
          <button
            data-testid="plan-delete-button"
            onClick={handleDeleteClick}
            className="text-red-400 hover:text-red-600"
          >
            <Trash2 className="h-5 w-5" />
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
    </>
  );
};

export default PlanCard;
