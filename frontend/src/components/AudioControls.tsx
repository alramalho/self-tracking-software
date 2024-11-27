// /app/components/AudioControls.tsx

import React, { forwardRef } from 'react';
import { Mic, LoaderCircle } from 'lucide-react';

interface AudioControlsProps {
  isRecording: boolean;
  isConnected: boolean;
  toggleRecording: () => void;
  isLoading: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({
  isRecording,
  isConnected,
  toggleRecording,
  isLoading,
}) => {
  return (
    <button
      onClick={toggleRecording}
      disabled={!isConnected || isLoading}
      className={`rounded-full flex items-center justify-center transition-all duration-200 p-4 text-white ${
        isRecording
          ? "bg-red-500 scale-110"
          : "bg-blue-500 hover:bg-blue-600"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? (
        <LoaderCircle className="animate-spin text-white" size={24} />
      ) : (
        <>
          <Mic className="text-white" size={24} />
          <span className="ml-2">{isRecording ? 'Stop' : 'Start'} Recording</span>
        </>
      )}
    </button>
  );
};

export default AudioControls;