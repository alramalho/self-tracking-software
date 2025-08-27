import React from 'react';
import { Button } from "@/components/ui/button";
import { RadialProgress } from "@/components/ui/radial-progress";
import { MessageSquarePlus, Users } from "lucide-react";

interface ReferralProgressProps {
  referredUsers: number;
  requiredReferrals: number;
  onShareReferral: () => void;
  onRequestAccess: () => void;
}

export const ReferralProgress: React.FC<ReferralProgressProps> = ({
  referredUsers,
  requiredReferrals,
  onShareReferral,
  onRequestAccess,
}) => {
  return (
    <div className="w-full max-w-sm mx-auto">
      <RadialProgress
        value={referredUsers}
        total={requiredReferrals}
        title="Referral Progress"
        description="Refer friends to unlock AI features"
        footer={
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {requiredReferrals - referredUsers} more friends needed
            </span>
            <Button variant="secondary" onClick={onShareReferral}>
              Share Referral Link
            </Button>
            or
            <Button onClick={() => window.open("https://buy.stripe.com/28obKQbsJbT98dqeUU", "_blank")}>
              Purchase Demo Access
            </Button>
          </div>
        }
      />
      {requiredReferrals - referredUsers === 0 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 shadow-sm">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="text-blue-500">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="font-semibold text-blue-900">
              You&apos;ve referred enough friends! Request access now.
            </h3>
            <p className="text-sm text-blue-700">
              Tell us how you plan to use the AI feature to get on the list
            </p>
            <Button
              variant="secondary"
              className="bg-white hover:bg-blue-50"
              onClick={onRequestAccess}
            >
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Request Access
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}; 