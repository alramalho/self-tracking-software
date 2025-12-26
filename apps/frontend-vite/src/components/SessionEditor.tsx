import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, X } from "lucide-react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import AppleLikePopover from "./AppleLikePopover";
import type { CalendarSession, CalendarActivity } from "./CalendarGrid";

export interface SessionUpdateData {
  activityId?: string;
  date?: string;
  quantity?: number;
  descriptiveGuide?: string;
}

interface SessionEditorProps {
  session: CalendarSession;
  activities: CalendarActivity[];
  onClose: () => void;
  onSave: (sessionId: string, updates: SessionUpdateData) => void;
  onUploadImages?: (sessionId: string, files: File[]) => Promise<string[]>;
  onDeleteImage?: (sessionId: string, imageUrl: string) => Promise<void>;
  open: boolean;
  isSaving?: boolean;
}

const MAX_FILE_SIZE = 150 * 1024;
const MAX_WIDTH = 1200;
const QUALITY = 0.7;

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

const SessionEditor: React.FC<SessionEditorProps> = ({
  session,
  activities,
  onClose,
  onSave,
  onUploadImages,
  onDeleteImage,
  open,
  isSaving = false,
}) => {
  const sessionDate = new Date(session.date);

  const [selectedDate, setSelectedDate] = useState<Date>(sessionDate);
  const [selectedActivityId, setSelectedActivityId] = useState<string>(session.activityId);
  const [quantity, setQuantity] = useState<number>(session.quantity || 0);
  const [descriptiveGuide, setDescriptiveGuide] = useState(session.descriptiveGuide || "");

  // Image state
  const [existingImages, setExistingImages] = useState<string[]>(session.imageUrls || []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null);

  // Sync existingImages when session.imageUrls changes (e.g., after upload/delete)
  // Use JSON.stringify for reliable array comparison since React compares arrays by reference
  const imageUrlsKey = JSON.stringify(session.imageUrls || []);
  useEffect(() => {
    setExistingImages(session.imageUrls || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrlsKey]);

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const maxImages = 10;
  const totalImages = existingImages.length + pendingFiles.length;

  const handleQuantityChange = (amount: number) => {
    setQuantity(Math.max(0, quantity + amount));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const newFiles = Array.from(event.target.files);

    if (totalImages + newFiles.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setIsProcessingImages(true);

    try {
      const processedFiles: File[] = [];

      for (const originalFile of newFiles) {
        let fileToCompress = originalFile;

        // Handle HEIC/HEIF conversion
        if (originalFile.type === "image/heic" || originalFile.type === "image/heif") {
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
      }

      setPendingFiles((prev) => [...prev, ...processedFiles]);
    } catch (error) {
      console.error("Error processing images:", error);
      toast.error("Failed to process some images");
    } finally {
      setIsProcessingImages(false);
      event.target.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingImage = async (imageUrl: string) => {
    if (!session.id || !onDeleteImage) return;

    setDeletingImageUrl(imageUrl);
    try {
      await onDeleteImage(session.id, imageUrl);
      setExistingImages((prev) => prev.filter((url) => url !== imageUrl));
      toast.success("Image deleted");
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete image");
    } finally {
      setDeletingImageUrl(null);
    }
  };

  const handleSave = async () => {
    if (!session.id) {
      console.error("Session ID is required for editing");
      return;
    }

    // Upload pending images first if any
    if (pendingFiles.length > 0 && onUploadImages) {
      setIsUploadingImages(true);
      try {
        const newImageUrls = await onUploadImages(session.id, pendingFiles);
        // Update existingImages immediately with the returned URLs
        setExistingImages(newImageUrls);
        setPendingFiles([]);
      } catch (error) {
        console.error("Error uploading images:", error);
        toast.error("Failed to upload images");
        setIsUploadingImages(false);
        return;
      }
      setIsUploadingImages(false);
    }

    // Then save other changes
    const updates: SessionUpdateData = {};

    if (selectedActivityId !== session.activityId) {
      updates.activityId = selectedActivityId;
    }
    if (selectedDate.toISOString() !== new Date(session.date).toISOString()) {
      updates.date = selectedDate.toISOString();
    }
    if (quantity !== session.quantity) {
      updates.quantity = quantity;
    }
    if (descriptiveGuide !== (session.descriptiveGuide || "")) {
      updates.descriptiveGuide = descriptiveGuide;
    }

    // Only call onSave if there are non-image changes
    if (Object.keys(updates).length > 0) {
      onSave(session.id, updates);
    } else if (pendingFiles.length === 0) {
      // If no changes at all, just close
      onClose();
    } else {
      // Images were uploaded, close the editor
      onClose();
    }
  };

  const hasChanges =
    selectedActivityId !== session.activityId ||
    selectedDate.toDateString() !== new Date(session.date).toDateString() ||
    quantity !== (session.quantity || 0) ||
    descriptiveGuide !== (session.descriptiveGuide || "") ||
    pendingFiles.length > 0;

  const isProcessing = isSaving || isUploadingImages || isProcessingImages;

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Edit Session">
      <div className="space-y-6 p-4">
        <div className="text-center">
          {selectedActivity && (
            <div className="text-4xl mb-4">{selectedActivity.emoji || "📋"}</div>
          )}
        </div>

        {/* Activity Selector */}
        <div>
          <h3 className="text-lg font-semibold mb-2 text-center">Activity</h3>
          <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Select activity" />
            </SelectTrigger>
            <SelectContent>
              {activities.map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>
                  <span className="flex items-center gap-2">
                    <span>{activity.emoji || "📋"}</span>
                    <span>{activity.title}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Picker */}
        <div>
          <h3 className="text-lg font-semibold mb-2 text-center">Date</h3>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date: Date | undefined) => {
              if (date) {
                setSelectedDate(date);
              }
            }}
            className="rounded-md border mx-auto"
          />
        </div>

        {/* Quantity */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">
            how many <i>{selectedActivity?.measure || "units"}</i>?
          </h3>
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={() => handleQuantityChange(-1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              -
            </Button>
            <span className="text-2xl font-bold">{quantity}</span>
            <Button
              onClick={() => handleQuantityChange(1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              +
            </Button>
          </div>
          <div className="mt-4 flex justify-center space-x-2">
            {[10, 30, 45, 60, 90].map((value) => (
              <Button
                key={value}
                onClick={() => setQuantity(value)}
                variant="secondary"
                className="bg-card"
                size="sm"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        {/* Descriptive Guide */}
        <div>
          <h3 className="text-lg font-semibold mb-2 text-center">Session Guide</h3>
          <Textarea
            value={descriptiveGuide}
            onChange={(e) => setDescriptiveGuide(e.target.value)}
            placeholder="Add session instructions or notes..."
            className="min-h-[100px]"
          />
        </div>

        {/* Images Section */}
        <div>
          <h3 className="text-lg font-semibold mb-2 text-center">Session Images</h3>

          {/* Existing + Pending Images Grid */}
          {(existingImages.length > 0 || pendingFiles.length > 0) && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {/* Existing images */}
              {existingImages.map((url, index) => (
                <div key={`existing-${index}`} className="relative aspect-square">
                  <img
                    src={url}
                    alt={`Session image ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {onDeleteImage && (
                    <button
                      onClick={() => handleDeleteExistingImage(url)}
                      className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-background disabled:opacity-50"
                      disabled={deletingImageUrl === url}
                    >
                      {deletingImageUrl === url ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}

              {/* Pending files (not yet uploaded) */}
              {pendingFiles.map((file, index) => (
                <div key={`pending-${index}`} className="relative aspect-square">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Pending ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                    <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">
                      Pending
                    </span>
                  </div>
                  <button
                    onClick={() => removePendingFile(index)}
                    className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-background"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          {totalImages < maxImages && (
            <div
              className={`border-2 border-dashed border-border bg-input rounded-lg text-center p-4 ${
                isProcessingImages
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:bg-muted/50"
              } flex items-center justify-center`}
              onClick={() =>
                !isProcessingImages &&
                document.getElementById("session-image-input")?.click()
              }
            >
              {isProcessingImages ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {totalImages === 0
                      ? "Add images (optional)"
                      : `Add more images (${totalImages}/${maxImages})`}
                  </p>
                </div>
              )}
            </div>
          )}

          <input
            id="session-image-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessingImages}
          />
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          className="w-full"
          disabled={!hasChanges || isProcessing}
        >
          {isUploadingImages
            ? "Uploading images..."
            : isSaving
              ? "Saving..."
              : "Save Changes"}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default SessionEditor;
