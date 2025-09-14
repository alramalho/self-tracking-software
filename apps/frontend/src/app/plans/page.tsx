"use client";

import PlansRenderer from "@/components/PlansRenderer";
import { useCurrentUser } from "@/contexts/users";
import { useSearchParams } from "next/navigation";
import React from "react";

const PlansPage: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const selectedPlanFromUrl = searchParams.get('selectedPlan');

  return (
    <div className="container mx-auto p-3 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">
        Welcome
        {currentUser?.name ? `, ${currentUser.name}` : ""}. Here are your
        active plans:
      </h1>
      <PlansRenderer initialSelectedPlanId={selectedPlanFromUrl} />
    </div>
  );
};

export default PlansPage;
