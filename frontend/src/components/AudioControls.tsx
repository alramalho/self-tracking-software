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
      <div className="flex items-center justify-between w-full gap-2">
        <button
          onClick={cancelRecording}
          className="p-2 text-gray-600 hover:text-red-600 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-sm text-gray-600">
            Recording...
          </div>
        </div>

        <button
          onClick={toggleRecording}
          className="p-2 text-gray-600 hover:text-green-600 transition-colors"
        >
          <Send size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full">
      <button
        onClick={toggleRecording}
        disabled={!isConnected || isLoading}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <LoaderCircle className="animate-spin" size={20} />
        ) : (
          <>
            <Mic size={20} />
            <span className="text-sm">Start Recording</span>
          </>
        )}
      </button>
    </div>
  );
};

export default AudioControls;