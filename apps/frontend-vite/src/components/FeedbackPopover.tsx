"use client";

import { useFeedback } from "@/hooks/useFeedback";
import { ArrowLeft, Bug, HelpCircle, ImagePlus, MessageSquarePlus, X } from "lucide-react";
import React, { useState } from "react";
import AppleLikePopover from "./AppleLikePopover";
import { Button } from "./ui/button";
import { TextAreaWithVoice } from "./ui/text-area-with-voice";

type FeedbackType = "help_request" | "feature_request" | "bug_report";

interface FeedbackCategory {
  id: FeedbackType;
  title: string;
  icon: React.ReactNode;
  placeholder: string;
  iconColor: string;
  bgColor: string;
}

interface FeedbackPopoverProps {
  email?: string;
  onClose: () => void;
  isEmailEditable?: boolean;
  open: boolean;
}

const FeedbackPopover = ({
  email: initialEmail,
  onClose,
  isEmailEditable,
  open,
}: FeedbackPopoverProps) => {
  const [selectedCategory, setSelectedCategory] = useState<FeedbackType | null>(null);
  const [text, setText] = useState("");
  const [email, setEmail] = useState(initialEmail || "");
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendFeedback } = useFeedback();

  // Auto-determine if email should be editable
  const effectiveIsEmailEditable = isEmailEditable !== undefined ? isEmailEditable : !initialEmail;

  const categories: FeedbackCategory[] = [
    {
      id: "help_request",
      title: "Question",
      icon: <HelpCircle size={24} />,
      placeholder: "What do you want to know?",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
    },
    {
      id: "feature_request", 
      title: "Feedback",
      icon: <MessageSquarePlus size={24} />,
      placeholder: "What feature would you like to see? Please describe how it would help you.",
      iconColor: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
    },
    {
      id: "bug_report",
      title: "Problem", 
      icon: <Bug size={24} />,
      placeholder: "Please describe the bug or problem you encountered...",
      iconColor: "text-red-600",
      bgColor: "bg-red-50 hover:bg-red-100",
    },
  ];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newImages = Array.from(files).slice(0, 3 - images.length); // Max 3 images
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !text.trim() || !email.trim()) return;

    setIsSubmitting(true);

    try {
      await sendFeedback({
        text,
        type: selectedCategory,
        email,
        images: images.length > 0 ? images : undefined,
      });

      setText("");
      setEmail(initialEmail || "");
      setImages([]);
      setSelectedCategory(null);
      onClose();
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setText("");
    setImages([]);
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setText("");
    setImages([]);
    setEmail(initialEmail || "");
    onClose();
  };

  const selectedCategoryData = categories.find(cat => cat.id === selectedCategory);

  return (
    <AppleLikePopover
      onClose={handleClose}
      open={open}
      title={selectedCategory ? selectedCategoryData?.title : "How can we help you?"}
    >
      <div className="p-4">
        {!selectedCategory ? (
          <>
            <h2 className="text-xl font-semibold mb-4">How can we help you?</h2>
            
            <div className="space-y-3">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full p-4 rounded-lg border border-border ${category.bgColor} transition-colors duration-200 flex items-center gap-4`}
                >
                  <div className={category.iconColor}>
                    {category.icon}
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-foreground">{category.title}</h4>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={20} />
              </button>
              <div className={`${selectedCategoryData?.iconColor}`}>
                {selectedCategoryData?.icon}
              </div>
              <h2 className="text-lg font-semibold">{selectedCategoryData?.title}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => effectiveIsEmailEditable && setEmail(e.target.value)}
                  disabled={!effectiveIsEmailEditable}
                  className={`w-full px-3 py-2 border border-border rounded-lg ${effectiveIsEmailEditable ? "bg-card" : "bg-muted"}`}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-1">Message</label>
                <TextAreaWithVoice
                  value={text}
                  onChange={setText}
                  className="w-full px-3 py-2 border border-border rounded-lg min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={selectedCategoryData?.placeholder}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Attach Images (optional, max 3)
                </label>

                {/* Image Previews */}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-border"
                        />
                        <button
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                {images.length < 3 && (
                  <label className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground transition-colors">
                    <ImagePlus size={20} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {images.length === 0 ? "Add images" : "Add more images"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!text.trim() || !email.trim() || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Sending..." : "Send"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppleLikePopover>
  );
};

export default FeedbackPopover;