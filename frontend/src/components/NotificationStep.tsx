import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BellIcon } from "lucide-react";

interface NotificationStepProps {
  onComplete: () => void;
  requestPermission: () => void;
  isPushGranted: boolean;
}

const NotificationStep: React.FC<NotificationStepProps> = ({
  onComplete,
  requestPermission,
  isPushGranted,
}) => {
  if (isPushGranted) {
    onComplete();
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Enable the Integrated Experience</CardTitle>
        <CardDescription>
          Get notifications to stay on top of your friends&apos; progress and receive proactive engagement from our AI coach.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          You can always adjust notification settings in your profile later.
        </div>
        <Button
          className="w-full"
          onClick={() => {
            onComplete();
            requestPermission();
          }}
        >
          <BellIcon className="mr-2 h-4 w-4" />
          Enable Notifications
        </Button>
      </CardContent>
    </Card>
  );
};

export default NotificationStep; 