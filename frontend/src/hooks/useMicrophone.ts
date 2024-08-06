// /app/hooks/useMicrophone.ts

import { useState, useCallback, useRef } from 'react';

export const useMicrophone = (socket: WebSocket | null) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (!socket) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        socket.send(JSON.stringify({
          action: 'stop_recording',
          audio_data: base64Audio
        }));
        
        chunksRef.current = [];
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      socket.send(JSON.stringify({ action: 'start_recording' }));
    } catch (error) {
      console.error('Error accessing microphone:', error);
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