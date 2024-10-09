import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";

interface ActivityEditorProps {
  onClose: () => void;
  onSave: (activity: {
    id?: string;
    title: string;
    measure: string;
    emoji: string;
  }) => void;
  activity?: { id: string; title: string; measure: string; emoji: string };
}

const ActivityEditor: React.FC<ActivityEditorProps> = ({
  onClose,
  onSave,
  activity,
}) => {
  const [title, setTitle] = useState(activity?.title || "");
  const [measure, setMeasure] = useState(activity?.measure || "");
  const [emoji, setEmoji] = useState(activity?.emoji || "");
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const api = useApiWithAuth();

  useEffect(() => {
    setIsVisible(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleSave = async () => {
    try {
      const response = await api.post("/api/upsert-activity", {
        id: activity?.id,
        title,
        measure,
        emoji,
      });

      const savedActivity = response.data;
      onSave(savedActivity);
      toast.success("Activity saved successfully!");
      handleClose();
    } catch (error) {
      console.error("Error saving activity:", error);
      toast.error("Failed to save activity. Please try again.");
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to finish
  };

  const handleSwipeUp = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    const startY = touch.pageY;
    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].pageY;
      if (startY - endY > 50) {
        // Swipe up threshold
        handleClose();
      }
      document.removeEventListener("touchend", handleTouchEnd);
    };
    document.addEventListener("touchend", handleTouchEnd);
  };

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-20 transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxWidth: "500px", margin: "0 auto" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleSwipeUp}
      >
        <div className="w-12 h-1 bg-gray-300 rounded mx-auto mb-6" />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={handleClose}
        >
          <X className="h-6 w-6" />
        </Button>
        <h2 className="text-2xl font-bold mb-4">
          {activity ? "Edit Activity" : "Add New Activity"}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            {emoji ? (
              <div className="text-4xl w-16 h-16 flex items-center justify-center border rounded-lg">
                {emoji}
              </div>
            ) : (
              <div
                className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-100"
                onClick={() => document.getElementById("emoji-input")?.focus()}
              >
                <Plus className="h-6 w-6 text-gray-400" />
              </div>
            )}
            <Input
              id="emoji-input"
              placeholder="Emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="text-2xl"
            />
          </div>
          <Input
            placeholder="Activity Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="Measure (e.g., minutes, times)"
            value={measure}
            onChange={(e) => setMeasure(e.target.value)}
          />
          <Button onClick={handleSave} className="w-full">
            Save Activity
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActivityEditor;
