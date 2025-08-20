"use client";

import React from "react";
import { useRouter } from "next/navigation";
import CreatePlanCardJourney from "@/components/CreatePlanCardJourney";
import toast from "react-hot-toast";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { twMerge } from "tailwind-merge";
import { SquareArrowUp } from "lucide-react";
import { capitalize } from "lodash";

const CreateNewPlan: React.FC = () => {
  const router = useRouter();
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const userPlanCount = userData?.plans?.length || 0;
  const { maxPlans, userPlanType: userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();

  if (userPlanCount >= maxPlans) {
    return (
      <AppleLikePopover
        open={true}
        onClose={() => {
          router.back();
        }}
      >
        <div className="flex flex-col items-start justify-center ">
          <h1 className="text-2xl font-bold mb-8 mt-2">Create New Plan</h1>
          <span
            className={twMerge(
              "text-3xl font-cursive flex items-center gap-2 my-8",
              userPaidPlanType === "FREE"
                ? "text-gray-500"
                : userPaidPlanType === "PLUS"
                ? "text-blue-500"
                : "text-indigo-500"
            )}
          >
            On {capitalize(userPaidPlanType || "FREE")} Plansss
          </span>
          <p>You have reached the maximum number of plans for your account.</p>
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
        toast.success("Plan creation finished successfully");
        router.push("/");
      }}
    >
      <h1 className="text-2xl font-bold mb-8">Create New Plan</h1>
    </CreatePlanCardJourney>
  );
};

export default CreateNewPlan;
