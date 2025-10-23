import PhotoUploader from "@/components/ui/PhotoUploader";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import React from "react";
import Number from "../Number";

interface BackgroundStepProps {
  backgroundImageUrl: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  number: number;
}

const BackgroundStep: React.FC<BackgroundStepProps> = ({
  backgroundImageUrl,
  onFileSelect,
  onRemove,
  number,
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2 block flex items-center gap-2">
        <Number>{number}</Number>
        Background image (optional)
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Upload a background image to personalize your plan card
      </p>
      <div className="space-y-2">
        <PhotoUploader
          onFileSelect={onFileSelect}
          currentImageUrl={backgroundImageUrl}
          placeholder="Click to upload a background image"
          className="w-full"
        />
        {backgroundImageUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRemove}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Remove background image
          </Button>
        )}
      </div>
    </div>
  );
};

export default BackgroundStep;
