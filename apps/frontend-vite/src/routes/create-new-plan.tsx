import AppleLikePopover from "@/components/AppleLikePopover";
import CreatePlanCardJourney from "@/components/CreatePlanCardJourney";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/contexts/plans";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { capitalize } from "@/lib/utils";
import { twMerge } from "tailwind-merge";

export const Route = createFileRoute("/create-new-plan")({
  component: CreateNewPlan,
});

function CreateNewPlan() {
  const navigate = useNavigate();
  const { plans } = usePlans();
  const userPlanCount = plans?.length || 0;
  const { maxPlans, userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();

  if (userPlanCount >= maxPlans) {
    return (
      <AppleLikePopover
        open={true}
        onClose={() => {
          navigate({ to: "/plans" });
        }}
      >
        <div className="flex flex-col items-start justify-center ">
          <h1 className="text-2xl font-bold mb-8 mt-2">Create New Plan</h1>
          <span
            className={twMerge(
              "text-3xl font-cursive flex items-center gap-2 my-3",
              userPaidPlanType === "FREE"
                ? "text-gray-500"
                : userPaidPlanType === "PLUS"
                ? "text-blue-500"
                : "text-indigo-500"
            )}
          >
            On {capitalize(userPaidPlanType || "FREE")} Plan
          </span>
          <p className="mb-5">
            You have reached the maximum number of plans for your account.
          </p>
          <Button
            className="w-full"
            onClick={() => setShowUpgradePopover(true)}
          >
            Upgrade
          </Button>
        </div>
      </AppleLikePopover>
    );
  }

  return (
    <CreatePlanCardJourney
      onComplete={() => {
        navigate({ to: "/plans" });
      }}
    >
      <h1 className="text-2xl font-bold mb-8">Create New Plan</h1>
    </CreatePlanCardJourney>
  );
}