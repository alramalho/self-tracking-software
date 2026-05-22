import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, MicIcon, SquareIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  addEventListener(type: "start", listener: (ev: Event) => void): void;
  addEventListener(type: "end", listener: (ev: Event) => void): void;
  addEventListener(type: "result", listener: (ev: SpeechRecognitionEvent) => void): void;
  addEventListener(type: "error", listener: (ev: SpeechRecognitionErrorEvent) => void): void;
  removeEventListener(type: "start", listener: (ev: Event) => void): void;
  removeEventListener(type: "end", listener: (ev: Event) => void): void;
  removeEventListener(type: "result", listener: (ev: SpeechRecognitionEvent) => void): void;
  removeEventListener(type: "error", listener: (ev: SpeechRecognitionErrorEvent) => void): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

type SpeechInputMode = "speech-recognition" | "media-recorder" | "none";

type SpeechInputProps = ComponentProps<typeof Button> & {
  onTranscriptionChange?: (text: string) => void;
  /**
   * Required for Firefox/Safari MediaRecorder fallback. Send this blob to a server-side
   * transcription endpoint and return the transcript. Never call client-side AI keys here.
   */
  onAudioRecorded?: (audioBlob: Blob) => Promise<string>;
  onUnsupportedClick?: () => void;
  lang?: string;
};

const detectSpeechInputMode = (): SpeechInputMode => {
  if (typeof window === "undefined") {
    return "none";
  }

  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    return "speech-recognition";
  }

  if ("MediaRecorder" in window && "mediaDevices" in navigator) {
    return "media-recorder";
  }

  return "none";
};

export const SpeechInput = ({
  className,
  onTranscriptionChange,
  onAudioRecorded,
  onUnsupportedClick,
  lang = "en-US",
  disabled,
  title,
  "aria-label": ariaLabel,
  ...props
}: SpeechInputProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecognitionPending, setIsRecognitionPending] = useState(false);
  const [mode] = useState<SpeechInputMode>(detectSpeechInputMode);
  const [isRecognitionReady, setIsRecognitionReady] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionPendingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const onTranscriptionChangeRef = useRef(onTranscriptionChange);
  const onAudioRecordedRef = useRef(onAudioRecorded);

  onTranscriptionChangeRef.current = onTranscriptionChange;
  onAudioRecordedRef.current = onAudioRecorded;

  const needsServerFallback = mode === "media-recorder" && !onAudioRecorded;
  const unavailable = mode === "none" || needsServerFallback;

  const setRecognitionPending = useCallback((pending: boolean) => {
    recognitionPendingRef.current = pending;
    setIsRecognitionPending(pending);
  }, []);

  useEffect(() => {
    if (mode !== "speech-recognition") {
      return;
    }

    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      return;
    }

    const speechRecognition = new SpeechRecognitionConstructor();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = lang;

    const handleStart = () => {
      setRecognitionPending(false);
      setIsListening(true);
    };
    const handleEnd = () => {
      setRecognitionPending(false);
      setIsListening(false);
    };
    const handleResult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? "";
        }
      }

      const trimmedTranscript = finalTranscript.trim();
      if (trimmedTranscript) {
        onTranscriptionChangeRef.current?.(trimmedTranscript);
      }
    };
    const handleError = () => {
      setRecognitionPending(false);
      setIsListening(false);
    };

    speechRecognition.addEventListener("start", handleStart);
    speechRecognition.addEventListener("end", handleEnd);
    speechRecognition.addEventListener("result", handleResult);
    speechRecognition.addEventListener("error", handleError);

    recognitionRef.current = speechRecognition;
    setIsRecognitionReady(true);

    return () => {
      speechRecognition.removeEventListener("start", handleStart);
      speechRecognition.removeEventListener("end", handleEnd);
      speechRecognition.removeEventListener("result", handleResult);
      speechRecognition.removeEventListener("error", handleError);
      try {
        speechRecognition.stop();
      } catch {
        // Some Web Speech implementations throw if stop() races with an error or never-started state.
      }
      recognitionRef.current = null;
      setRecognitionPending(false);
      setIsRecognitionReady(false);
    };
  }, [mode, lang, setRecognitionPending]);

  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const startMediaRecorder = useCallback(async () => {
    if (!onAudioRecordedRef.current) {
      onUnsupportedClick?.();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      const handleDataAvailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      const handleStop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        if (audioBlob.size > 0 && onAudioRecordedRef.current) {
          setIsProcessing(true);
          try {
            const transcript = await onAudioRecordedRef.current(audioBlob);
            const trimmedTranscript = transcript.trim();
            if (trimmedTranscript) {
              onTranscriptionChangeRef.current?.(trimmedTranscript);
            }
          } catch {
            onUnsupportedClick?.();
          } finally {
            setIsProcessing(false);
          }
        }
      };

      const handleError = () => {
        setIsListening(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.addEventListener("dataavailable", handleDataAvailable);
      mediaRecorder.addEventListener("stop", handleStop);
      mediaRecorder.addEventListener("error", handleError);

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      onUnsupportedClick?.();
    }
  }, [onUnsupportedClick]);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (unavailable) {
      onUnsupportedClick?.();
      return;
    }

    if (mode === "speech-recognition" && recognitionRef.current) {
      if (recognitionPendingRef.current) {
        return;
      }

      setRecognitionPending(true);
      try {
        if (isListening) {
          recognitionRef.current.stop();
        } else {
          recognitionRef.current.start();
        }
      } catch {
        setRecognitionPending(false);
        setIsListening(false);
        onUnsupportedClick?.();
      }
      return;
    }

    if (mode === "media-recorder") {
      if (isListening) {
        stopMediaRecorder();
      } else {
        startMediaRecorder();
      }
    }
  }, [isListening, mode, onUnsupportedClick, setRecognitionPending, startMediaRecorder, stopMediaRecorder, unavailable]);

  const isDisabled =
    disabled ||
    isProcessing ||
    isRecognitionPending ||
    (mode === "speech-recognition" && !isRecognitionReady);
  const computedTitle =
    title ??
    (needsServerFallback
      ? "Voice transcription needs a server transcription endpoint in this browser. Try Chrome or Edge."
      : mode === "none"
        ? "Voice input is not supported in this browser."
        : isListening
          ? "Stop voice input"
          : "Start voice input");
  const computedAriaLabel =
    ariaLabel ??
    (isListening ? "Stop voice input" : "Start voice input");

  return (
    <div className="relative inline-flex items-center justify-center">
      {isListening &&
        [0, 1, 2].map((index) => (
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full border-2 border-red-400/30"
            key={index}
            style={{
              animationDelay: `${index * 0.3}s`,
              animationDuration: "2s",
            }}
          />
        ))}

      <Button
        aria-label={computedAriaLabel}
        aria-pressed={isListening}
        className={cn(
          "relative z-10 rounded-full transition-all duration-300",
          isListening
            ? "bg-red-500 text-white hover:bg-red-600 hover:text-white"
            : "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/25 hover:text-foreground",
          unavailable && "opacity-60",
          className
        )}
        disabled={isDisabled}
        onClick={toggleListening}
        title={computedTitle}
        type="button"
        {...props}
      >
        {isProcessing && <Loader2 className="size-4 animate-spin" />}
        {!isProcessing && isListening && <SquareIcon className="size-4" />}
        {!(isProcessing || isListening) && <MicIcon className="size-4" />}
        <span className="sr-only">{computedTitle}</span>
      </Button>
    </div>
  );
};
