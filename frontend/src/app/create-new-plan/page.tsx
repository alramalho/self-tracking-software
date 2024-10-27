"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import toast from "react-hot-toast";

const CreateNewPlan: React.FC = () => {
  const router = useRouter();

  return (
    <Onboarding
      isNewPlan={true}
      onComplete={() => {
        toast.success("Plan creation finished successfully");
        router.push("/");
      }}
    />
  );
};

export default CreateNewPlan;
