import React from "react";
import { Button } from "@/components/ui/button";
import { Mic, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  transcription: string;
  isConnected: boolean;
  isLoading: boolean;
  isRecording?: boolean;
  onTranscriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => void;
  onToggleRecording?: () => void;
  onCancelRecording?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  transcription,
  isConnected,
  isLoading,
  isRecording = false,
  onTranscriptionChange,
  onSendMessage,
  onToggleRecording,
  onCancelRecording,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="relative flex items-center w-full gap-2">
      <textarea
        value={transcription}
        onChange={onTranscriptionChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className={cn(
          "w-full resize-none bg-transparent outline-none",
          "max-h-32 py-3 pl-4 pr-20",
          isRecording && "hidden"
        )}
        rows={1}
        disabled={!isConnected || isLoading}
      />
      
      {isRecording && (
        <div className="flex items-center justify-between w-full gap-2 py-3 pl-4">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">●</span>
            <span className="text-sm">Recording...</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelRecording}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleRecording}
              className="h-8 w-8"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {!isRecording && (
        <div className="absolute right-2 flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleRecording}
                className="h-8 w-8"
                disabled={!isConnected}
              >
                <Mic className="h-5 w-5" />
              </Button>
              {transcription && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSendMessage}
                  className="h-8 w-8"
                  disabled={!isConnected}
                >
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}; 