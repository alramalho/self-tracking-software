"use client";

import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import PhotoUploader from "@/components/ui/PhotoUploader";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import { useUserPlan } from "@/contexts/UserGlobalContext";
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
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState("");
  const { refetchUserData } = useUserPlan();
  const { addToNotificationCount } = useNotifications();
  const api = useApiWithAuth();

  const logActivity = async () => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("activityId", activityData.activityId);
      formData.append("iso_date_string", activityData.date.toISOString());
      formData.append("quantity", activityData.quantity.toString());
      formData.append("description", description || "");
      formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      
      if (selectedFile) {
        formData.append("photo", selectedFile);
      }

      await api.post("/activities/log-activity", formData);

      refetchUserData(false);
      toast.success(
        selectedFile
          ? "Activity logged with photo successfully!"
          : "Activity logged successfully!"
      );
      addToNotificationCount(1, 'profile');
      onSuccess();
    } catch (error: any) {
      console.error("Error logging activity:", error);
      toast.error("Failed to log activity. Please try again.");
    } finally {
      setIsUploading(false);
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
            disabled={isUploading}
            className="w-full"
          />
        </div>
        <TextAreaWithVoice
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="How was your activity? Share your thoughts..."
          disabled={isUploading}
        />
        <div className="mb-3">
          <Info className="w-5 h-5 text-gray-500 mb-1 mr-2 inline" />
          <p className="text-md text-gray-500 mb-6 inline">
            Only you and your friends can see this info until it expires after
            7 days.
          </p>
        </div>
        <Button
          size="lg"
          onClick={logActivity}
          className="w-full"
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {selectedFile ? "Upload" : "Log without photo"}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityPhotoUploader;
