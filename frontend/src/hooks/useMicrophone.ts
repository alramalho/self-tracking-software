import { arrayBufferToBase64Async } from "@/lib/utils";
import { useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";

export const useMicrophone = (socket: WebSocket | null) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (!socket) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("getUserMedia is not supported on your browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!window.MediaRecorder) {
        throw new Error("MediaRecorder is not supported on your browser");
      }

      // Prioritize formats that are easier for the server to handle
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

        // Extract the file extension from the MIME type
        const fileExtension = selectedType.split("/")[1];

        socket.send(
          JSON.stringify({
            action: "stop_recording",
            audio_data: base64Audio,
            audio_format: fileExtension, // Send just the file extension, not the full MIME type
          })
        );

        chunksRef.current = [];
      };

      // Improved start: use a timeslice of 1000ms for all browsers to fix buggy mp4 recording https://community.openai.com/t/whisper-api-completely-wrong-for-mp4/289256/12
      mediaRecorderRef.current.start(1000);

      setIsRecording(true);
      socket.send(JSON.stringify({ action: "start_recording" }));
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error(`Error accessing microphone: ${error}`);
    }
  }, [socket]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && socket) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [socket]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, toggleRecording };
};
