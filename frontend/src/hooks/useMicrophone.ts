import { arrayBufferToBase64Async } from "@/lib/utils";
import { useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";

type FinishedCallback = (audioData: string, audioFormat: string) => void;

export const useMicrophone = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async (onFinished: FinishedCallback) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not supported on your browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!window.MediaRecorder) {
        throw new Error("MediaRecorder is not supported on your browser");
      }

      const mimeTypes = ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"];
      let selectedType = mimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      if (!selectedType) {
        throw new Error("No supported audio MIME types found");
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: selectedType,
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: selectedType });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio: string = await arrayBufferToBase64Async(arrayBuffer);

        const fileExtension = selectedType.split("/")[1];

        onFinished(base64Audio, fileExtension);

        chunksRef.current = [];
      };

      mediaRecorderRef.current.start(1000);

      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error(`Error accessing microphone: ${error}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const toggleRecording = useCallback(
    (onFinished: FinishedCallback) => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording(onFinished);
      }
    },
    [isRecording, startRecording, stopRecording]
  );

  return { isRecording, toggleRecording };
};
