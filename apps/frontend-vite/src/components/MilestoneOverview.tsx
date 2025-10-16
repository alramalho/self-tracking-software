import React from "react";

// Stub implementation - replace with actual implementation when needed
interface MilestoneOverviewProps {
  milestones: any[];
  planId?: string;
  onEdit?: () => void;
}

export const MilestoneOverview: React.FC<MilestoneOverviewProps> = ({
  milestones,
  planId,
  onEdit,
}) => {
  return (
    <div className="p-4 border rounded-lg bg-muted">
      <p className="text-sm text-muted-foreground">Milestone Overview (placeholder)</p>
      <p className="text-sm">Milestones: {milestones.length}</p>
    </div>
  );
};