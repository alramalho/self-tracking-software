"use client";

import React from "react";
import PlansRenderer from "@/components/PlansRenderer";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { useSearchParams } from "next/navigation";

const PlansPage: React.FC = () => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const searchParams = useSearchParams();
  const selectedPlanFromUrl = searchParams.get('selectedPlan');

  return (
    <div className="container mx-auto p-3 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">
        Welcome
        {userData?.name ? `, ${userData.name}` : ""}. Here are your
        active plans:
      </h1>

      <PlansRenderer initialSelectedPlanId={selectedPlanFromUrl} />
    </div>
  );
};

export default PlansPage;
