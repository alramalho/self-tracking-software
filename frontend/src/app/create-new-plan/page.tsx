"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import {
  convertPlanToApiPlan,
  Plan,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import toast from "react-hot-toast";

const CreateNewPlan: React.FC = () => {
  const router = useRouter();
  const { userData, setUserData } = useUserPlan();

  const handleNewPlanComplete = (newPlan: Plan) => {
    const currentUserData = userData["me"];
    if (currentUserData) {
      router.push("/"); // Redirect to home page after creating the plan
    } else {
      toast.error("Failed to create new plan. User data not found.");
    }
  };

  return <Onboarding isNewPlan={true} onComplete={handleNewPlanComplete} />;
};

export default CreateNewPlan;
