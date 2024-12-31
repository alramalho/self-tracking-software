import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMicrophone } from "@/hooks/useMicrophone";

interface ChatInputProps {
  isConnected: boolean;
  isLoading: boolean;
  onVoiceSent: (audioData: string, audioFormat: string) => void;
  onTextSent: (text: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  isConnected,
  isLoading,
  onVoiceSent,
  onTextSent,
}) => {
  const [text, setText] = useState("");
  const { isRecording, toggleRecording, cancelRecording } = useMicrophone();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleSendText = () => {
    if (!text.trim() || !isConnected || isLoading) return;
    onTextSent(text);
    setText("");
  };

  const startRecording = () => {
    if (!isConnected || isLoading) return;
    toggleRecording(onVoiceSent);
  };

  const stopRecording = () => {
    if (!isConnected || isLoading) return;
    toggleRecording(onVoiceSent);
  };

  return (
    <div className="relative flex items-center w-full gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
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
                onClick={startRecording}
                className="h-8 w-8"
                disabled={!isConnected}
              >
                <Mic className="h-5 w-5" />
              </Button>
              {text && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSendText}
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