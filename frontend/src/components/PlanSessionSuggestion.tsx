import React from 'react';
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export interface PlanSession {
  date: string;
  activity_id: string;
  descriptive_guide: string;
  quantity: number;
}

interface PlanSessionSuggestionProps {
  session: PlanSession;
  onAccept: (session: PlanSession) => void;
  onReject: (session: PlanSession) => void;
  disabled?: boolean;
  decision?: 'accepted' | 'rejected';
}

const PlanSessionSuggestion: React.FC<PlanSessionSuggestionProps> = ({
  session,
  onAccept,
  onReject,
  disabled = false,
  decision,
}) => {
  return (
    <div className={`flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border my-2 max-w-md w-full
      ${decision === 'accepted' ? 'border-green-200 bg-green-50' : 
        decision === 'rejected' ? 'border-red-200 bg-red-50' : 
        'border-gray-200'}`}>
      <div className="flex-1">
        <p className="font-medium">{session.descriptive_guide}</p>
        <p className="text-sm text-gray-600">
          {session.quantity} on {session.date}
        </p>
        {decision && (
          <p className={`text-sm mt-1 ${
            decision === 'accepted' ? 'text-green-600' : 'text-red-600'
          }`}>
            {decision === 'accepted' ? 'Accepted' : 'Rejected'}
          </p>
        )}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onAccept(session)}
            disabled={disabled}
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onReject(session)}
            disabled={disabled}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default PlanSessionSuggestion; 