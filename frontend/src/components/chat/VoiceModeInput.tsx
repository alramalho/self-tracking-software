import React from "react";
import { Button } from "@/components/ui/button";
import { Mic, Send, X } from "lucide-react";
import { useMicrophone } from "@/hooks/useMicrophone";
import { InputContainer } from "./InputContainer";

interface VoiceModeInputProps {
  isConnected: boolean;
  isLoading: boolean;
  onVoiceSent: (audioData: string, audioFormat: string) => void;
  onModeToggle: () => void;
}

export const VoiceModeInput: React.FC<VoiceModeInputProps> = ({
  isConnected,
  isLoading,
  onVoiceSent,
  onModeToggle,
}) => {
  const { isRecording, toggleRecording, cancelRecording } = useMicrophone();

  const startRecording = () => {
    if (!isConnected || isLoading) return;
    toggleRecording(onVoiceSent);
  };

  const stopRecording = () => {
    if (!isConnected || isLoading) return;
    toggleRecording(onVoiceSent);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <InputContainer>
        <div className="flex items-center justify-between w-full px-4">
          <div className="flex items-center gap-2">
            {isRecording ? (
              <>
                <span className="animate-pulse text-red-500">●</span>
                <span className="text-sm">Recording...</span>
              </>
            ) : (
              <span className="text-sm text-gray-500">Tap mic to start...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isRecording ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cancelRecording}
                  className="h-8 w-8"
              >
                  <X className="h-5 w-5" />
                </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={stopRecording}
                    className="h-8 w-8"
                    disabled={!isConnected}
                  >
                    <Send className="h-5 w-5" />
                  </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={startRecording}
                className="h-8 w-8"
                disabled={!isConnected || isLoading}
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </InputContainer>
      
      <button
        onClick={onModeToggle}
        className="text-sm text-gray-500 hover:text-gray-700 italic underline"
      >
        Switch to text mode
      </button>
    </div>
  );
}; 