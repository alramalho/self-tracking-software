"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useSpeaker } from "@/hooks/useSpeaker";
import AudioControls from "@/components/AudioControls";
import toast, { Toaster } from "react-hot-toast";
import { Wifi, WifiOff, Mic, MessageSquare, LoaderCircle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@clerk/nextjs";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const LogPage: React.FC = () => {
  const { getToken } = useAuth();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { isRecording, toggleRecording } = useMicrophone(socket);
  const { addToQueue } = useSpeaker();
  const { addNotifications, sendNotification } = useNotifications();

  const [transcription, setTranscription] = useState<string>("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = useCallback(async () => {
    const token = await getToken();
    const newSocket = new WebSocket(
      `${process.env.NEXT_PUBLIC_BACKEND_WS_URL!}?token=${token}`
    );

    newSocket.onopen = () => {
      setIsConnected(true);
      toast.success("WebSocket connected");
    };

    newSocket.onclose = () => {
      setIsConnected(false);
      toast.error("WebSocket disconnected");
    };

    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast.error("WebSocket error occurred");
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

  const addMessage = (message: Message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const handleIncomingAudio = useCallback(
    (base64Audio: string, transcription: string) => {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      addToQueue(bytes.buffer);

      addMessage({ role: "assistant", content: transcription } as Message);

      setIsLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [addToQueue]
  );

  const handleActivitiesUpdate = useCallback(
    (
      newActivityEntries: any[],
      notificationText: string,
      reportedMood: boolean
    ) => {
      if ((newActivityEntries.length > 0 || reportedMood) && notificationText) {
        addNotifications(newActivityEntries.length + (reportedMood ? 1 : 0));
        toast(notificationText, {
          duration: 5000,
          position: "top-center",
          icon: "📊",
        });
      }
    },
    [addNotifications]
  );

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      // Create a copy of the data for logging
      const logData = { ...data };
      if (logData.audio) {
        logData.audio = "<audio file>";
      }
      console.log("Received message:", logData);

      if (data.type === "audio") {
        handleIncomingAudio(data.audio, data.transcription);
      } else if (data.type === "activities_update") {
        handleActivitiesUpdate(
          data.new_activity_entries,
          data.new_activities_notification,
          data.reported_mood
        );
      } else if (data.type === "transcription") {
        setTranscription(data.text);
        addMessage({ role: "user", content: `🎙️ ${data.text}` });
        setIsLoading(true);

        // Set timeout for server response
        timeoutRef.current = setTimeout(() => {
          setIsLoading(false);
          toast.error("Server response timed out", {
            position: "top-right",
          });
        }, 20000);
      }
    };
  }, [socket, handleIncomingAudio, handleActivitiesUpdate]);

  const handleReconnect = () => {
    if (socket) {
      socket.close();
    }
    connectWebSocket();
  };

  const handleTranscriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setTranscription(e.target.value);
  };

  const handleTranscriptionSubmit = () => {
    if (socket && isConnected) {
      setIsLoading(true);
      socket.send(
        JSON.stringify({
          action: "update_transcription",
          text: transcription,
        })
      );

      addMessage({ role: "user", content: transcription });

      // Set timeout for server response
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        toast.error("Server response timed out", {
          position: "top-right",
        });
      }, 20000);
    }
  };

  const toggleInputMode = () => {
    setInputMode((prevMode) => (prevMode === "voice" ? "text" : "voice"));
  };

  useEffect(() => {
    console.log({ messages });
  }, [messages]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {isLoading && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <LoaderCircle className="animate-spin text-gray-600" size={24} />
        </div>
      )}
      <ChatMessageList className="max-w-xl">
        {messages.map((message, index) => (
          <ChatBubble
            key={index}
            variant={message.role == "assistant" ? "received" : "sent"}
          >
            <ChatBubbleAvatar
              src={
                message.role == "assistant"
                  ? "https://htmlcolorcodes.com/assets/images/colors/sky-blue-color-solid-background-1920x1080.png"
                  : "https://htmlcolorcodes.com/assets/images/colors/orange-color-solid-background-1920x1080.png"
              }
            />
            <ChatBubbleMessage>{message.content}</ChatBubbleMessage>
          </ChatBubble>
        ))}
      </ChatMessageList>
      <h1 className="text-2xl mb-4">tracking.so</h1>
      <div className="flex items-center mb-4">
        {isConnected ? (
          <Wifi className="text-green-500 mr-2" size={20} />
        ) : (
          <WifiOff className="text-red-500 mr-2" size={20} />
        )}
        <span className="text-sm font-medium">
          {isConnected ? "Connected" : "Disconnected"}
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
        {inputMode === "voice" ? (
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
      <button onClick={() => sendNotification("Hello", { body: "World" })}>
        Send Notification
      </button>
      {inputMode === "voice" ? (
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
