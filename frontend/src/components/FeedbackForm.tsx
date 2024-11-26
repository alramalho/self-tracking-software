"use client";

import React, { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "./ui/button";

interface FeedbackFormProps {
  title: string;
  email: string;
  placeholder?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
  defaultValue?: string;
}

const FeedbackForm = ({ 
  title, 
  email, 
  placeholder = "Please describe your issue...",
  defaultValue,
  onSubmit, 
  onClose,
}: FeedbackFormProps) => {
  const [text, setText] = useState(defaultValue || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(text);
    setText("");
    onClose();
  };

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4`}>
      <div className="bg-white rounded-lg w-full max-w-md p-4 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">Message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg min-h-[120px] focus:outline-none focus:ring-2 focus:ring-gray-200"
              placeholder={placeholder}
              required
            />
          </div>

          <Button
            variant="default"
            type="submit"
            className="w-full"
          >
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
};

export default FeedbackForm; 