import React, { useState } from "react";
import PlanSessionSuggestion, { PlanSession } from "./PlanSessionSuggestion";
import { Button } from "./ui/button";

interface PlanSessionsSuggestionProps {
  sessions: PlanSession[];
  onFinish: (result: {
    accepted: PlanSession[];
    rejected: PlanSession[];
  }) => void;
}

const PlanSessionsSuggestion: React.FC<PlanSessionsSuggestionProps> = ({
  sessions,
  onFinish,
}) => {
  const [decisions, setDecisions] = useState<
    Record<string, "accepted" | "rejected" | undefined>
  >({});

  const handleDecision = (
    session: PlanSession,
    decision: "accepted" | "rejected"
  ) => {
    setDecisions((prev) => ({
      ...prev,
      [session.date + session.activity_id]: decision,
    }));
  };

  const allDecisionsMade = sessions.every(
    (session) => decisions[session.date + session.activity_id]
  );

  const handleFinish = () => {
    const accepted = sessions.filter(
      (session) => decisions[session.date + session.activity_id] === "accepted"
    );
    const rejected = sessions.filter(
      (session) => decisions[session.date + session.activity_id] === "rejected"
    );
    onFinish({ accepted, rejected });
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-md">
      <div className="bg-blue-50 p-4 rounded-lg w-full mb-4">
        <h3 className="font-medium text-blue-900 mb-2">
          Suggested Plan Updates
        </h3>
        <p className="text-sm text-blue-700">
          Please review and accept/reject each suggested session update.
        </p>
      </div>

      {sessions.map((session) => (
        <PlanSessionSuggestion
          key={session.date + session.activity_id}
          session={session}
          onAccept={() => handleDecision(session, "accepted")}
          onReject={() => handleDecision(session, "rejected")}
          disabled={decisions[session.date + session.activity_id] !== undefined}
          decision={decisions[session.date + session.activity_id]}
        />
      ))}

      {allDecisionsMade && (
        <Button onClick={handleFinish} className="w-full mt-4">
          Confirm Decisions
        </Button>
      )}
    </div>
  );
};

export default PlanSessionsSuggestion;
