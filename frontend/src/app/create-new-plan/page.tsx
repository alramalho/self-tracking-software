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
  const { setPlans, plans } = useUserPlan();

  const handleNewPlanComplete = (newPlan: Plan) => {
    setPlans([...plans, convertPlanToApiPlan(newPlan)]);
    toast.success("New plan created successfully!");
    router.push("/"); // Redirect to home page after creating the plan
  };

  return <Onboarding isNewPlan={true} onComplete={handleNewPlanComplete} />;
};

export default CreateNewPlan;
