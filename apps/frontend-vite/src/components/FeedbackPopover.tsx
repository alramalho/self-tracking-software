"use client";

import { useFeedback } from "@/hooks/useFeedback";
import { ArrowLeft, Bug, HelpCircle, MessageSquarePlus } from "lucide-react";
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
  email: string;
  onClose: () => void;
  isEmailEditable?: boolean;
  open: boolean;
}

const FeedbackPopover = ({ 
  email: initialEmail, 
  onClose,
  isEmailEditable = false,
  open,
}: FeedbackPopoverProps) => {
  const [selectedCategory, setSelectedCategory] = useState<FeedbackType | null>(null);
  const [text, setText] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendFeedback } = useFeedback();

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

  const handleSubmit = async () => {
    if (!selectedCategory || !text.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await sendFeedback({ text, type: selectedCategory });
      
      setText("");
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
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setText("");
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
                  className={`w-full p-4 rounded-lg border border-gray-200 ${category.bgColor} transition-colors duration-200 flex items-center gap-4`}
                >
                  <div className={category.iconColor}>
                    {category.icon}
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900">{category.title}</h4>
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
                className="text-gray-500 hover:text-gray-700"
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
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => isEmailEditable && setEmail(e.target.value)}
                  disabled={!isEmailEditable}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">Message</label>
                <TextAreaWithVoice
                  value={text}
                  onChange={setText}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg min-h-[120px] focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder={selectedCategoryData?.placeholder}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!text.trim() || isSubmitting}
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