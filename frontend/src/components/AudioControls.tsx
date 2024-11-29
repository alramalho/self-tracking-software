// /app/components/AudioControls.tsx

import React from 'react';
import { Mic, LoaderCircle, X, Send } from 'lucide-react';

interface AudioControlsProps {
  isRecording: boolean;
  isConnected: boolean;
  toggleRecording: () => void;
  cancelRecording?: () => void;
  isLoading: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  isRecording,
  isConnected,
  toggleRecording,
  cancelRecording,
  isLoading,
}) => {
  if (isRecording) {
    return (
      <div className="flex gap-2">
        <button
          onClick={cancelRecording}
          className="rounded-full flex items-center justify-center transition-all duration-200 p-4 text-white bg-gray-500 hover:bg-gray-600"
        >
          <X className="text-white" size={24} />
          <span className="ml-2">Cancel</span>
        </button>
        <button
          onClick={toggleRecording}
          className="rounded-full flex items-center justify-center transition-all duration-200 p-4 text-white bg-green-500 hover:bg-green-600"
        >
          <Send className="text-white" size={24} />
          <span className="ml-2">Send</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={toggleRecording}
      disabled={!isConnected || isLoading}
      className={`rounded-full flex items-center justify-center transition-all duration-200 p-4 text-white 
        bg-blue-500 hover:bg-blue-600
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? (
        <LoaderCircle className="animate-spin text-white" size={24} />
      ) : (
        <>
          <Mic className="text-white" size={24} />
          <span className="ml-2">Start Recording</span>
        </>
      )}
    </button>
  );
};

export default AudioControls;