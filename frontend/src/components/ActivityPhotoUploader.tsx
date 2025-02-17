"use client";

import React, { useState } from "react";
import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { toast } from "react-hot-toast";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { Info, Mic, Loader2 } from "lucide-react";
import { TextAreaWithVoice } from "@/components/ui/TextAreaWithVoice";
import { useMicrophone } from "@/hooks/useMicrophone";

const MAX_FILE_SIZE = 150 * 1024; // 150KB in bytes
const MAX_WIDTH = 1200; // Max width for the compressed image
const QUALITY = 0.7; // Initial quality setting for compression

// Move compression logic to a client-side utility
const compressImage = async (file: File): Promise<File> => {
  // Only run in browser environment
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
        const compressedFile = new File([blob], file.name, {
          type: "image/jpeg",
        });

        resolve(compressedFile);
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
  const [isPublic, setisPublic] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { addToNotificationCount } = useNotifications();
  const api = useApiWithAuth();
  const { isRecording, toggleRecording } = useMicrophone();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      try {
        let toastId;
        if (file.type === "image/heic" || file.type === "image/heif") {
          toastId = toast.loading("Converting HEIC image...");
        }

        let processedFile = file;
        if (file.type === "image/heic" || file.type === "image/heif") {
          // Dynamically import heic2any only when needed
          const heic2any = (await import('heic2any')).default;
          const blob = (await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.8,
          })) as Blob;
          processedFile = new File(
            [blob],
            file.name.replace(/\.heic$/i, ".jpg"),
            { type: "image/jpeg" }
          );
          if (toastId) toast.dismiss(toastId);
        }

        const compressedFile = await compressImage(processedFile);
        console.log(
          `Original size: ${file.size / 1024}KB, Compressed size: ${
            compressedFile.size / 1024
          }KB`
        );
        setSelectedFile(compressedFile);
      } catch (error) {
        console.error("Error processing image:", error);
        toast.error("Failed to process image. Please try again.");
      }
    }
  };

  const handleVoiceRecording = async (
    audioData: string,
    audioFormat: string
  ) => {
    try {
      setIsTranscribing(true);
      const formData = new FormData();
      formData.append("audio_data", audioData);
      formData.append("audio_format", audioFormat);

      const response = await api.post("/ai/transcribe", formData);
      const transcribedText = response.data.text;

      // Append transcribed text to existing description
      setDescription((prev) => {
        const separator = prev ? " " : "";
        return prev + separator + transcribedText;
      });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error("Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
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
      formData.append("description", description);

      if (selectedFile) {
        formData.append("photo", selectedFile);
      }

      await api.post("/log-activity", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      currentUserDataQuery.refetch();
      toast.success(
        selectedFile
          ? "Activity logged with photo successfully!"
          : "Activity logged successfully!"
      );
      addToNotificationCount(1, 'profile');

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
            isUploading
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:bg-gray-50"
          }`}
          onClick={() =>
            !isUploading && document.getElementById("photo-input")?.click()
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
          disabled={isUploading}
        />
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
