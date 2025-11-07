import { Camera, Loader2, X } from "lucide-react";
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

interface MultiPhotoUploaderProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const MultiPhotoUploader: React.FC<MultiPhotoUploaderProps> = ({
  onFilesChange,
  maxFiles = 10,
  disabled = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles = Array.from(event.target.files);

      if (selectedFiles.length + newFiles.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} photos allowed`);
        return;
      }

      setIsProcessing(true);
      let toastId = toast.loading("Processing images...");

      try {
        const processedFiles: File[] = [];

        for (const originalFile of newFiles) {
          try {
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
            }

            const compressedFile = await compressImage(fileToCompress);
            processedFiles.push(compressedFile);
          } catch (error) {
            console.error("Error processing image:", error);
          }
        }

        toast.dismiss(toastId);

        const updatedFiles = [...selectedFiles, ...processedFiles];
        setSelectedFiles(updatedFiles);
        onFilesChange(updatedFiles);

      } catch (error) {
        toast.dismiss(toastId);
        console.error("Error processing images:", error);
        toast.error("Failed to process some images. Please try again.");
      } finally {
        setIsProcessing(false);
        // Reset the input so the same file can be selected again
        event.target.value = "";
      }
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  return (
    <div className="space-y-3">
      {/* Image grid */}
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative aspect-square">
              <img
                src={URL.createObjectURL(file)}
                alt={`Selected ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-background"
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {selectedFiles.length < maxFiles && (
        <div
          className={`border-2 border-dashed border-border bg-input rounded-lg text-center p-4 ${
            isProcessing || disabled
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:bg-muted/50"
          } flex items-center justify-center`}
          onClick={() =>
            !isProcessing &&
            !disabled &&
            document.getElementById("multi-photo-input")?.click()
          }
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Camera className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length === 0
                  ? "Add photos (optional)"
                  : `Add more photos (${selectedFiles.length}/${maxFiles})`}
              </p>
            </div>
          )}
        </div>
      )}

      <input
        id="multi-photo-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing || disabled}
      />
    </div>
  );
};

export default MultiPhotoUploader;
