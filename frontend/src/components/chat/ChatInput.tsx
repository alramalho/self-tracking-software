import React from 'react';
import { LoaderCircle, Send } from 'lucide-react';

interface ChatInputProps {
  transcription: string;
  isConnected: boolean;
  isLoading: boolean;
  onTranscriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => void;
}

export const ChatInput = ({
  transcription,
  isConnected,
  isLoading,
  onTranscriptionChange,
  onSendMessage,
}: ChatInputProps) => {
  return (
    <div className="flex items-center w-full gap-2">
      <textarea
        value={transcription}
        onChange={onTranscriptionChange}
        placeholder="Type a message..."
        className="flex-1 bg-transparent border-none focus:ring-0 resize-none h-[40px] py-2"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
          }
        }}
      />
      <button
        onClick={onSendMessage}
        disabled={!isConnected}
        className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : <Send size={20} />}
      </button>
    </div>
  );
}; 