import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, BellIcon } from "lucide-react";
import InviteButton from "./InviteButton";

interface InviteAndNotificationStepProps {
  selectedPlan: ApiPlan | null;
  onComplete: () => void;
  requestPermission: () => void;
  isPushGranted: boolean;
  userDataQuery: any;
}

const InviteAndNotificationStep: React.FC<InviteAndNotificationStepProps> = ({
  selectedPlan,
  onComplete,
  requestPermission,
  isPushGranted,
  userDataQuery,
}) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          Challenge People to do it with you! (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <InviteButton
          embedded={true}
          planId={selectedPlan!.id!}
          onInviteSuccess={() => {
            userDataQuery.refetch();
          }}
        />
        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={() => onComplete()}
        >
          <ChevronRight className="mr-2 h-4 w-4" />
          Skip
        </Button>
      </CardContent>
    </Card>
  );
};

export default InviteAndNotificationStep; 