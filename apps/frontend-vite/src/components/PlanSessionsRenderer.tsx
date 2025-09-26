import React from "react";

// Stub implementation - replace with actual implementation when needed
interface PlanSessionsRendererProps {
  plan: any;
  activities: any[];
  startDate?: Date;
}

const PlanSessionsRenderer: React.FC<PlanSessionsRendererProps> = ({
  plan,
  activities,
  startDate,
}) => {
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <p className="text-sm text-gray-500">Plan Sessions Renderer (placeholder)</p>
      <p className="text-sm">Plan: {plan?.goal}</p>
      <p className="text-sm">Activities: {activities.length}</p>
    </div>
  );
};

export default PlanSessionsRenderer;