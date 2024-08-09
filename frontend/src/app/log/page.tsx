'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useMicrophone } from '@/hooks/useMicrophone';
import { useSpeaker } from '@/hooks/useSpeaker';
import AudioControls from '@/components/AudioControls';
import toast, { Toaster } from 'react-hot-toast';
import { Wifi, WifiOff, Mic, MessageSquare, LoaderCircle } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

const LogPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { isRecording, toggleRecording } = useMicrophone(socket);
  const { addToQueue } = useSpeaker();
  const { addNotifications } = useNotifications();

  const [transcription, setTranscription] = useState<string>('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleIncomingAudio = useCallback((base64Audio: string, transcription: string, newActivities: any[], newActivityEntries: any[]) => {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    addToQueue(bytes.buffer);
    
    toast(transcription, {
      duration: Math.max(2000, 400 * transcription.split(' ').length),
      icon: "🤖",
    });

    if (newActivityEntries.length > 0) {
      addNotifications(newActivityEntries.length);
      toast(`${newActivityEntries.length} new activities logged!`, {
        duration: 5000,
        position: 'top-left',
        icon: "📊",
      });
    }

    setIsLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [addToQueue, addNotifications]);

  useEffect(() => {
   if (!socket) return;

    socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      // Create a copy of the data for logging
      const logData = { ...data };
      if (logData.audio) {
        logData.audio = '<audio file>';
      }
      console.log('Received message:', logData);

      if (data.type === 'audio') {
        handleIncomingAudio(data.audio, data.transcription, data.new_activities, data.new_activity_entries);
      } else if (data.type === 'transcription') {
        toast.success(data.text, {
          duration: Math.max(2000, 3000 + 1200 * data.text.split(' ').length),
          position: 'bottom-center',
        });
        setTranscription(data.text);
        setIsLoading(true);
        
        // Set timeout for server response
        timeoutRef.current = setTimeout(() => {
          setIsLoading(false);
          toast.error('Server response timed out', {
            position: 'top-right',
          });
        }, 20000);
      }
    };
  }, [socket, handleIncomingAudio]);

  const handleReconnect = () => {
    if (socket) {
      socket.close();
    }
    connectWebSocket();
  };

  const handleTranscriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscription(e.target.value);
  };

  const handleTranscriptionSubmit = () => {
    if (socket && isConnected) {
      setIsLoading(true);
      socket.send(JSON.stringify({
        action: 'update_transcription',
        text: transcription
      }));

      // Set timeout for server response
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        toast.error('Server response timed out', {
          position: 'top-right',
        });
      }, 20000);
    }
  };

  const toggleInputMode = () => {
    setInputMode(prevMode => prevMode === 'voice' ? 'text' : 'voice');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {isLoading && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <LoaderCircle className="animate-spin text-gray-600" size={24} />
        </div>
      )}
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
      <button
        onClick={toggleInputMode}
        className="mb-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors flex items-center"
      >
        {inputMode === 'voice' ? (
          <>
            <Mic className="mr-2" size={20} />
            Switch to Text
          </>
        ) : (
          <>
            <MessageSquare className="mr-2" size={20} />
            Switch to Voice
          </>
        )}
      </button>
      {inputMode === 'voice' ? (
        <AudioControls
          isRecording={isRecording}
          isConnected={isConnected}
          toggleRecording={toggleRecording}
        />
      ) : (
        <div className="w-full max-w-md">
          <textarea
            value={transcription}
            onChange={handleTranscriptionChange}
            className="w-full p-2 border rounded"
            rows={4}
            placeholder="Type your message here..."
          />
          <button
            onClick={handleTranscriptionSubmit}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors w-full"
            disabled={!isConnected}
          >
            Submit Message
          </button>
        </div>
      )}
    </div>
  );
};

export default LogPage;