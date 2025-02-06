import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Loader2 } from "lucide-react";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useApiWithAuth } from "@/api";
import { toast } from "react-hot-toast";

interface TextAreaWithVoiceProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const TextAreaWithVoice: React.FC<TextAreaWithVoiceProps> = ({
  value,
  onChange,
  placeholder,
  label,
  disabled,
  className,
}) => {
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const { isRecording, toggleRecording } = useMicrophone();
  const api = useApiWithAuth();

  const handleVoiceRecording = async (
    audioData: string,
    audioFormat: string
  ) => {
    try {
      setIsTranscribing(true);
      const formData = new FormData();
      formData.append("audio_data", audioData);
      formData.append("audio_format", audioFormat);

      const response = await api.post("/ai/transcribe", formData);
      const transcribedText = response.data.text;

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
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          <span>{label}</span>
        </label>
      )}
      <div className="relative">
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full min-h-[80px] pr-12 ${className}`}
          disabled={disabled || isTranscribing}
        />
        <div className="absolute right-2 bottom-2">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-full hover:bg-gray-100 ${isTranscribing ? "opacity-50" : ""}`}
            onClick={() => toggleRecording(handleVoiceRecording)}
            disabled={disabled || isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRecording ? (
              <Mic className="h-5 w-5 text-red-400" />
            ) : (
              <Mic className="h-5 w-5 text-gray-500" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}; 