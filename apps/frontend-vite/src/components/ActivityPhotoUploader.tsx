"use client";

import { Button } from "@/components/ui/button";
import PhotoUploader from "@/components/ui/photo-uploader";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { useActivities } from "@/contexts/activities/useActivities";
import { useNotifications } from "@/hooks/useNotifications";
import { Info, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";


interface ActivityPhotoUploaderProps {
  activityData: {
    activityId: string;
    date: Date;
    quantity: number;
  };
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
}


const ActivityPhotoUploader: React.FC<ActivityPhotoUploaderProps> = ({
  activityData,
  onClose,
  onSuccess,
  open,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const { logActivity: submitActivity, isLoggingActivity } = useActivities();
  const { addToNotificationCount } = useNotifications();

  const handleLogActivity = async () => {
    try {
      await submitActivity({
        activityId: activityData.activityId,
        date: activityData.date,
        quantity: activityData.quantity,
        description,
        photo: selectedFile || undefined,
      });
      
      addToNotificationCount(1, 'profile');
      onSuccess();
    } catch (error: any) {
      console.error("Error logging activity:", error);
      toast.error("Failed to log activity. Please try again.");
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} unclosable>
      <h2 className="text-2xl font-bold mb-4">📸 Add a proof!</h2>
      <div className="space-y-4">
        <div className="flex justify-center">
          <PhotoUploader
            onFileSelect={setSelectedFile}
            placeholder="Click to upload a photo"
            disabled={isLoggingActivity}
            className="w-full"
          />
        </div>
        <TextAreaWithVoice
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="How was your activity? Share your thoughts..."
          disabled={isLoggingActivity}
        />
        <div className="mb-3">
          <Info className="w-5 h-5 text-muted-foreground mb-1 mr-2 inline" />
          <p className="text-md text-muted-foreground mb-6 inline">
            Only you and your friends can see this info until it expires after
            7 days.
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleLogActivity}
          className="w-full"
          disabled={isLoggingActivity}
        >
          {isLoggingActivity ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {selectedFile ? "Upload" : "Log without photo"}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityPhotoUploader;
