'use client';


import React, { useEffect, useState, useCallback } from 'react';
import { useMicrophone } from '@/hooks/useMicrophone';
import { useSpeaker } from '@/hooks/useSpeaker';
import AudioControls from '@/components/AudioControls';
import toast, { Toaster } from 'react-hot-toast';
import { Wifi, WifiOff } from 'lucide-react';

const LogPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { isRecording, toggleRecording } = useMicrophone(socket);
  const { addToQueue } = useSpeaker();

  const connectWebSocket = useCallback(() => {
    const newSocket = new WebSocket('ws://localhost:8000/connect');
    
    newSocket.onopen = () => {
      setIsConnected(true);
      toast.success('WebSocket connected');
    };
    
    newSocket.onclose = () => {
      setIsConnected(false);
      toast.error('WebSocket disconnected');
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('WebSocket error occurred');
    };

    setSocket(newSocket);
  }, []);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connectWebSocket]);

  const handleIncomingAudio = useCallback((base64Audio: string, transcription: string) => {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    addToQueue(bytes.buffer);
    
    toast(transcription, {
      duration: Math.max(2000, 400 * transcription.split(' ').length),
      icon: "✋",
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

  const handleReconnect = () => {
    if (socket) {
      socket.close();
    }
    connectWebSocket();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl mb-4">Log App</h1>
      <div className="flex items-center mb-4">
        {isConnected ? (
          <Wifi className="text-green-500 mr-2" size={20} />
        ) : (
          <WifiOff className="text-red-500 mr-2" size={20} />
        )}
        <span className="text-sm font-medium">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <button
          onClick={handleReconnect}
          className="ml-2 text-blue-500 hover:text-blue-600 transition-colors"
        >
          Reconnect
        </button>
      </div>
      <AudioControls
        isRecording={isRecording}
        isConnected={isConnected}
        toggleRecording={toggleRecording}
      />
      <Toaster />
    </div>
  );
};

export default LogPage;