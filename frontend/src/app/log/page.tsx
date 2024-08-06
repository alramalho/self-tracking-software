// /app/pages/LogPage.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useMicrophone } from '@/hooks/useMicrophone';
import { useSpeaker } from '@/hooks/useSpeaker';
import AudioControls from '@/components/AudioControls';
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"


const LogPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { isRecording, toggleRecording } = useMicrophone(socket);
  const { addToQueue } = useSpeaker();
  

  useEffect(() => {
    const newSocket = new WebSocket('ws://localhost:8000/connect');
    setSocket(newSocket);

    newSocket.onopen = () => setIsConnected(true);
    newSocket.onclose = () => setIsConnected(false);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleIncomingAudio = useCallback((base64Audio: string, transcription: string) => {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    addToQueue(bytes.buffer);
    
    // Show toast notification with transcription
    toast(transcription, {
      duration: Math.max(2000, 400 * transcription.split(' ').length),
    });
  }, [addToQueue]);

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'audio') {
        handleIncomingAudio(data.audio, data.transcription);
      }
    };
  }, [socket, handleIncomingAudio]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl mb-4">Log App</h1>
      <AudioControls
        isRecording={isRecording}
        isConnected={isConnected}
        toggleRecording={toggleRecording}
      />
      <Toaster 
        position="bottom-center" 
        toastOptions={{
          style: {
            background: 'rgb(55 65 81)', // Tailwind's gray-700
            color: 'white',
            border: 'none',
          },
        }}
      />
    </div>
  );
};

export default LogPage;