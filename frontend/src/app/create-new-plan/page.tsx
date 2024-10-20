"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import { ApiPlan, useUserPlan } from "@/contexts/UserPlanContext";
import toast from "react-hot-toast";

const CreateNewPlan: React.FC = () => {
  const router = useRouter();

  return <Onboarding isNewPlan={true} onComplete={() => router.push("/")} />;
};

export default CreateNewPlan;
