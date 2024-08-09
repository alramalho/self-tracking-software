// /app/components/AudioControls.tsx

import React, { forwardRef } from 'react';
import { Mic } from 'lucide-react';

interface AudioControlsProps {
  isRecording: boolean;
  isConnected: boolean;
  toggleRecording: () => void;
}

const AudioControls = forwardRef<HTMLButtonElement, AudioControlsProps>(
  ({ isRecording, isConnected, toggleRecording }, ref) => {
    return (
      <div className="flex flex-col items-center">
        <button
          ref={ref}
          onClick={toggleRecording}
          className={`flex items-center justify-center p-4 rounded-full ${
            isRecording ? 'bg-red-500' : isConnected? 'bg-blue-500': 'bg-gray-500'
          } text-white`}
          disabled={!isConnected}
        >
          <Mic size={24} />
          <span className="ml-2">{isRecording ? 'Stop' : 'Start'} Recording</span>
        </button>
      </div>
    );
  }
);

AudioControls.displayName = 'AudioControls';

export default AudioControls;