import React, { useState } from "react";
import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { Info } from "lucide-react";

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
  const [isPublic, setisPublic] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const { addToNotificationCount } = useNotifications();
  const api = useApiWithAuth();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const logActivity = async () => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("activity_id", activityData.activityId);
      formData.append("iso_date_string", activityData.date.toISOString());
      formData.append("quantity", activityData.quantity.toString());
      formData.append("isPublic", isPublic.toString());
      
      if (selectedFile) {
        formData.append("photo", selectedFile);
      }

      await api.post("/log-activity", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      userDataQuery.refetch();
      toast.success(selectedFile ? "Activity logged with photo successfully!" : "Activity logged successfully!");
      addToNotificationCount(1);
      onSuccess();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to log activity. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} unclosable>
      <h2 className="text-2xl font-bold mb-4">📸 Add a proof!</h2>
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${
            isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
          }`}
          onClick={() => !isUploading && document.getElementById("photo-input")?.click()}
        >
          {selectedFile ? (
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Selected"
              className="max-w-full h-auto mx-auto"
            />
          ) : (
            <div>
              <p className="text-gray-500">Click to upload a photo</p>
              <p className="text-sm text-gray-400">or drag and drop</p>
            </div>
          )}
        </div>
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        <div className="mb-3">
          <Info className="w-5 h-5 text-gray-500 mb-1 mr-2 inline" />
          <p className="text-md text-gray-500 mb-6 inline">
            Only you and your friends can see this photo until it expires after
            7 days.
          </p>
        </div>
        <Button
          size="lg"
          onClick={logActivity}
          className="w-full"
          loading={isUploading}
          disabled={isUploading}
        >
          {selectedFile ? "Upload" : "Log without photo"}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityPhotoUploader;
