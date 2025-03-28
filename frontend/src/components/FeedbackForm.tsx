"use client";

import React, { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "./ui/button";
import { TextAreaWithVoice } from "./ui/TextAreaWithVoice";

interface FeedbackFormProps {
  title: string;
  email: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (text: string, email: string) => void;
  onClose: () => void;
  isEmailEditable?: boolean;
  className?: string;
}

const FeedbackForm = ({ 
  title, 
  email: initialEmail, 
  placeholder = "Please describe your issue...",
  defaultValue,
  onSubmit, 
  onClose,
  isEmailEditable = false,
  className,
}: FeedbackFormProps) => {
  const [text, setText] = useState(defaultValue || "");
  const [email, setEmail] = useState(initialEmail);

  const handleSubmit = () => {
    onSubmit(text, email);
    setText("");
    onClose();
  };

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4 ${className}`}>
      <div className="bg-white rounded-lg w-full max-w-md p-4 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        
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
              placeholder={placeholder}
            />
          </div>

          <Button
            variant="default"
            onClick={handleSubmit}
            className="w-full"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackForm; 