"use client";

import React from "react";
import { useRouter } from "next/navigation";
import CreatePlanCardJourney from "@/components/CreatePlanCardJourney";
import toast from "react-hot-toast";

const CreateNewPlan: React.FC = () => {
  const router = useRouter();

  return (
    <CreatePlanCardJourney
      onComplete={() => {
        toast.success("Plan creation finished successfully");
        router.push("/");
      }}
    >
      <h1 className="text-2xl font-bold mb-8">
        Create New Plan
      </h1> 
    </CreatePlanCardJourney>
  );
};

export default CreateNewPlan;
