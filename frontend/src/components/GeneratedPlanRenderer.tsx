import React from "react";
import { format } from "date-fns";
import {
  GeneratedPlan,
  convertGeneratedPlanToPlan,
} from "@/contexts/UserPlanContext";
import PlanSessionsRenderer from "./PlanSessionsRenderer";

interface GeneratedPlanRendererProps {
  plan: GeneratedPlan;
  title: string;
}

const GeneratedPlanRenderer: React.FC<GeneratedPlanRendererProps> = ({
  plan,
  title,
}) => {
  return (
    <>
      <div className="p-4">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p>
          {plan.emoji ? plan.emoji : "Goal:"} {plan.goal}
        </p>
        <p>
          Finishing Date:{" "}
          {plan.finishing_date
            ? format(plan.finishing_date, "yyyy-MM-dd")
            : "Not specified"}
        </p>
        <p>Number of sessions: {plan.sessions?.length || 0}</p>
        <div className="mt-4 mb-4">
          <h3 className="text-lg font-semibold mb-2">Plan Overview:</h3>
          <p className="text-sm text-gray-600">{plan.overview}</p>
        </div>
        <PlanSessionsRenderer
          plan={convertGeneratedPlanToPlan(plan)}
          activities={plan.activities}
        />
      </div>
    </>
  );
};

export default GeneratedPlanRenderer;
