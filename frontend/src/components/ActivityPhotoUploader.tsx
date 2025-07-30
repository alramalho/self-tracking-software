"use client";

import React, { useState } from "react";
// import { useApiWithAuth } from "@/api"; // Will be replaced
import { useOfflineAwareApi } from "@/hooks/useOfflineAwareApi"; // Import the new hook
import { useUserPlan } from "@/contexts/UserPlanContext";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { Info, Loader2 } from "lucide-react";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";

const MAX_FILE_SIZE = 150 * 1024; // 150KB in bytes
const MAX_WIDTH = 1200; // Max width for the compressed image
const QUALITY = 0.7; // Initial quality setting for compression

// Helper to convert File to ArrayBuffer
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const compressImage = async (file: File): Promise<File> => {
  if (typeof window === 'undefined') return file;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = QUALITY;
        let dataUrl: string;
        do {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          quality -= 0.1;
        } while (dataUrl.length > MAX_FILE_SIZE * 1.37 && quality > 0.1);
        const byteString = atob(dataUrl.split(",")[1]);
        const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

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

interface SerializablePhotoData {
  buffer: ArrayBuffer;
  name: string;
  type: string;
}

const ActivityPhotoUploader: React.FC<ActivityPhotoUploaderProps> = ({
  activityData,
  onClose,
  onSuccess,
  open,
}) => {
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<File | null>(null);
  const [serializablePhotoData, setSerializablePhotoData] = useState<SerializablePhotoData | null>(null);
  // const [isPublic, setIsPublic] = useState(false); // Unused
  const [isProcessingOrUploading, setIsProcessingOrUploading] = useState(false);
  const [description, setDescription] = useState("");
  const { refetchUserData } = useUserPlan();
  const { addToNotificationCount } = useNotifications();
  const api = useOfflineAwareApi();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const originalFile = event.target.files[0];
      setIsProcessingOrUploading(true);
      let toastId;
      try {
        if (originalFile.type === "image/heic" || originalFile.type === "image/heif") {
          toastId = toast.loading("Converting HEIC image...");
        }

        let fileToCompress = originalFile;
        if (originalFile.type === "image/heic" || originalFile.type === "image/heif") {
          const heic2any = (await import('heic2any')).default;
          const blob = (await heic2any({
            blob: originalFile,
            toType: "image/jpeg",
            quality: 0.8,
          })) as Blob;
          fileToCompress = new File([blob], originalFile.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
          if (toastId) toast.dismiss(toastId);
          toastId = toast.loading("Compressing image..."); // New toast for compression
        } else {
          toastId = toast.loading("Compressing image...");
        }

        const compressedFile = await compressImage(fileToCompress);
        if (toastId) toast.dismiss(toastId);

        const arrayBuffer = await readFileAsArrayBuffer(compressedFile);
        setSerializablePhotoData({
          buffer: arrayBuffer,
          name: compressedFile.name,
          type: compressedFile.type,
        });
        setSelectedFileForPreview(compressedFile); // Still use File object for preview

        console.log(
          `Original size: ${originalFile.size / 1024}KB, Compressed size: ${
            compressedFile.size / 1024
          }KB`
        );
      } catch (error) {
        if (toastId) toast.dismiss(toastId);
        console.error("Error processing image:", error);
        toast.error("Failed to process image. Please try again.");
        setSerializablePhotoData(null);
        setSelectedFileForPreview(null);
      } finally {
        setIsProcessingOrUploading(false);
      }
    }
  };

  const logActivity = async () => {
    setIsProcessingOrUploading(true);

    const basePayload = {
      activityId: activityData.activityId,
      iso_date_string: activityData.date.toISOString(),
      quantity: activityData.quantity.toString(), // Ensure quantity is string for FormData
      description: description || "", // Ensure description is at least an empty string for FormData
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      // isPublic can be added here if needed, ensure string conversion
    };

    let dataToSend: any;
    let headersConfig = {}; // Default for FormData (let browser set Content-Type)

    if (api.isOnline) {
      // ONLINE: Always send FormData to /log-activity
      const formData = new FormData();
      Object.keys(basePayload).forEach(key => formData.append(key, (basePayload as any)[key]));
      if (serializablePhotoData) { // Or use selectedFileForPreview if it's always set when serializablePhotoData is
        const photoFile = new File([serializablePhotoData.buffer], serializablePhotoData.name, { type: serializablePhotoData.type });
        formData.append("photo", photoFile);
      }
      dataToSend = formData;
      // headersConfig remains {} for FormData
    } else {
      // OFFLINE: Send JSON payload for queueing. If photo exists, embed serializable data.
      dataToSend = { ...basePayload }; // Start with base stringified data
      if (serializablePhotoData) {
        dataToSend.photo = {
          buffer: serializablePhotoData.buffer,
          name: serializablePhotoData.name,
          type: serializablePhotoData.type,
        };
      }
      headersConfig = { 'Content-Type': 'application/json' }; // This header is for the addTask internal representation, not for the final API call
                                                              // The generic handler in useOfflineAwareApi will reconstruct FormData anyway for /log-activity
    }

    try {
      const response = await api.post("/activities/log-activity", dataToSend, { headers: headersConfig }, {
        title: serializablePhotoData ? "Log with photo" : "Log activity",
        successMessage: serializablePhotoData ? "Activity with photo synced!" : "Activity synced!",
        errorMessage: serializablePhotoData ? "Failed to sync photo." : "Failed to sync activity."
      });

      if (response && response.__queued__) {
        onSuccess();
      } else {
        refetchUserData(false);
        toast.success(
          serializablePhotoData
            ? "Activity logged with photo successfully!"
            : "Activity logged successfully!"
        );
        addToNotificationCount(1, 'profile');
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error logging activity:", error);
      if (!error.isOfflineFormDataError && !error.isOfflinePreconditionError) { 
         toast.error("Failed to log activity. Please try again.");
      }
    } finally {
      setIsProcessingOrUploading(false);
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} unclosable>
      <h2 className="text-2xl font-bold mb-4">📸 Add a proof!</h2>
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${
            isProcessingOrUploading
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:bg-gray-50"
          }`}
          onClick={() =>
            !isProcessingOrUploading && document.getElementById("photo-input")?.click()
          }
        >
          {selectedFileForPreview ? (
            <img
              src={URL.createObjectURL(selectedFileForPreview)}
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
          disabled={isProcessingOrUploading}
        />
        <TextAreaWithVoice
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="How was your activity? Share your thoughts..."
          disabled={isProcessingOrUploading}
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
          disabled={isProcessingOrUploading}
        >
          {isProcessingOrUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {serializablePhotoData ? "Upload" : "Log without photo"}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityPhotoUploader;
