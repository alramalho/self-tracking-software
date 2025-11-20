import React from "react";

interface PlanDescriptionProps {
  goal: string;
  message?: string | null;
  overlay?: boolean;
}

const PlanDescription: React.FC<PlanDescriptionProps> = ({
  goal,
  message,
  overlay = false,
}) => {
  if (overlay) {
    return (
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/50 to-transparent backdrop-blur-md">
        <p className="text-sm text-white font-medium text-center mb-1">
          {goal}
        </p>
        {message && (
          <p className="text-xs text-white/90 text-center">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 text-center">
      <p className="text-sm text-muted-foreground mb-2">{goal}</p>
      {message && <p className="text-sm text-foreground">{message}</p>}
    </div>
  );
};

export default PlanDescription;
