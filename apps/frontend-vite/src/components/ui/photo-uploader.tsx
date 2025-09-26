"use client";

import { Camera, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";

const MAX_FILE_SIZE = 150 * 1024; // 150KB in bytes
const MAX_WIDTH = 1200; // Max width for the compressed image
const QUALITY = 0.7; // Initial quality setting for compression

const compressImage = async (file: File): Promise<File> => {
  if (typeof window === "undefined") return file;
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

interface PhotoUploaderProps {
  onFileSelect: (file: File) => void;
  currentImageUrl?: string;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  onFileSelect,
  currentImageUrl,
  placeholder = "Click to upload a photo",
  className = "",
  disabled = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files[0]) {
      const originalFile = event.target.files[0];
      setIsProcessing(true);
      let toastId;

      try {
        if (
          originalFile.type === "image/heic" ||
          originalFile.type === "image/heif"
        ) {
          toastId = toast.loading("Converting HEIC image...");
        }

        let fileToCompress = originalFile;
        if (
          originalFile.type === "image/heic" ||
          originalFile.type === "image/heif"
        ) {
          const heic2any = (await import("heic2any")).default;
          const blob = (await heic2any({
            blob: originalFile,
            toType: "image/jpeg",
            quality: 0.8,
          })) as Blob;
          fileToCompress = new File(
            [blob],
            originalFile.name.replace(/\.heic$/i, ".jpg"),
            { type: "image/jpeg" }
          );
          if (toastId) toast.dismiss(toastId);
          toastId = toast.loading("Compressing image...");
        } else {
          toastId = toast.loading("Compressing image...");
        }

        const compressedFile = await compressImage(fileToCompress);
        if (toastId) toast.dismiss(toastId);

        setSelectedFile(compressedFile);
        onFileSelect(compressedFile);

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
        setIsProcessing(false);
      }
    }
  };

  const displayImageUrl = selectedFile
    ? URL.createObjectURL(selectedFile)
    : currentImageUrl;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`border-2 border-dashed border-gray-300 rounded-lg text-center w-full min-h-32 ${
          isProcessing || disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:bg-gray-50"
        } flex items-center justify-center overflow-hidden`}
        onClick={() =>
          !isProcessing &&
          !disabled &&
          document.getElementById("photo-input")?.click()
        }
      >
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt="Selected photo"
            className="max-h-96 object-cover rounded-lg"
          />
        ) : (
          <div className="p-2">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            ) : (
              <>
                <Camera className="w-12 h-12 text-gray-400 mx-auto" />
                <p className="text-md text-gray-500">{placeholder}</p>
              </>
            )}
          </div>
        )}
      </div>
      <input
        id="photo-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing || disabled}
      />
    </div>
  );
};

export default PhotoUploader;
