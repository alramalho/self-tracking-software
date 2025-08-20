"use client";

import React, { useState } from "react";
import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserGlobalContext";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { Info, Loader2 } from "lucide-react";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";

const MAX_FILE_SIZE = 150 * 1024; // 150KB in bytes
const MAX_WIDTH = 1200; // Max width for the compressed image
const QUALITY = 0.7; // Initial quality setting for compression


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


const ActivityPhotoUploader: React.FC<ActivityPhotoUploaderProps> = ({
  activityData,
  onClose,
  onSuccess,
  open,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // const [isPublic, setIsPublic] = useState(false); // Unused
  const [isProcessingOrUploading, setIsProcessingOrUploading] = useState(false);
  const [description, setDescription] = useState("");
  const { refetchUserData } = useUserPlan();
  const { addToNotificationCount } = useNotifications();
  const api = useApiWithAuth();

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

        setSelectedFile(compressedFile);

        console.log(
          `Original size: ${originalFile.size / 1024}KB, Compressed size: ${
            compressedFile.size / 1024
          }KB`
        );
      } catch (error) {
        if (toastId) toast.dismiss(toastId);
        console.error("Error processing image:", error);
        toast.error("Failed to process image. Please try again.");
        setSelectedFile(null);
      } finally {
        setIsProcessingOrUploading(false);
      }
    }
  };

  const logActivity = async () => {
    setIsProcessingOrUploading(true);

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
          {selectedFile ? "Upload" : "Log without photo"}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityPhotoUploader;
