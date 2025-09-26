import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMicrophone } from "@/hooks/useMicrophone";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic } from "lucide-react";
import React from "react";
import { toast } from "react-hot-toast";

interface TextAreaWithVoiceProps {
  value: string;
  onChange: (value: string) => void;
  onVoiceTranscripted?: (transcript: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  onRecordingStarted?: () => void;
  onRecordingStopped?: () => void;
}

export const TextAreaWithVoice: React.FC<TextAreaWithVoiceProps> = ({
  value,
  onChange,
  onVoiceTranscripted,
  placeholder,
  label,
  disabled,
  className,
  onRecordingStarted,
  onRecordingStopped,
}) => {
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [showPointer, setShowPointer] = React.useState(true);
  const { isRecording, toggleRecording } = useMicrophone();
  const api = useApiWithAuth();

  const pointerAnimation = {
    initial: { x: 5, opacity: 0 },
    animate: {
      x: [5, -10, 5],
      opacity: [0.9, 1, 0.9],
      transition: {
        duration: 1.5,
        repeat: 2,
        ease: "easeInOut",
        onComplete: () => setShowPointer(false),
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  const handleVoiceRecording = async (
    audioData: string,
    audioFormat: string
  ) => {
    try {
      setIsTranscribing(true);
      const formData = new FormData();
      
      // Convert base64 to blob and create a file
      const byteCharacters = atob(audioData);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
        const slice = byteCharacters.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      const blob = new Blob(byteArrays, { type: `audio/${audioFormat}` });
      const file = new File([blob], `audio.${audioFormat}`, { type: `audio/${audioFormat}` });
      
      formData.append("audio_file", file);
      formData.append("audio_format", audioFormat);

      const response = await api.post("/ai/transcribe", formData);
      const transcribedText = response.data.text;
      onVoiceTranscripted?.(transcribedText);

      // Append transcribed text to existing value
      const separator = value ? " " : "";
      onChange(value + separator + transcribedText);
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error("Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="space-y-2 bg-white">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          <span>{label}</span>
        </label>
      )}
      <div className="relative">
        <Textarea
          placeholder={placeholder || "You can also record a voice message for extended detail"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full min-h-[80px] max-h-[200px] pr-12 ${className}`}
          disabled={disabled || isTranscribing}
          rows={5}
        />
        <div className="absolute right-2 bottom-2">
          <AnimatePresence>
            {showPointer && (
              <motion.div
                className="absolute right-full mr-2 top-0 -translate-y-1/2 flex flex-row items-center gap-2"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={pointerAnimation}
              >
                <span className="text-2xl">👉</span>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-full hover:bg-gray-100 ${isTranscribing ? "opacity-50" : ""}`}
            onClick={() => {
              if (isRecording) {
                onRecordingStopped?.();
              } else {
                onRecordingStarted?.();
              }
              toggleRecording(handleVoiceRecording);
            }}
            disabled={disabled || isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isRecording ? (
              <Mic className="h-6 w-6 text-red-400" />
            ) : (
              <Mic className="h-6 w-6 text-gray-700" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}; 