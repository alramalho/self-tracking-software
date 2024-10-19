"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useMessageHistory, Message } from "@/hooks/useMessageHistory"; // Add this import
import { useMicrophone } from "@/hooks/useMicrophone";
import { useSpeaker } from "@/hooks/useSpeaker";
import AudioControls from "@/components/AudioControls";
import toast, { Toaster } from "react-hot-toast";
import {
  Wifi,
  WifiOff,
  Mic,
  MessageSquare,
  LoaderCircle,
  Volume2,
  VolumeX,
  Trash2,
} from "lucide-react"; // Add this import
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@clerk/nextjs";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useSearchParams } from "next/navigation";
import { useApiWithAuth } from "@/api";

import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { Switch } from "@/components/ui/switch";
import AppleLikePopover from "@/components/AppleLikePopover";

const LogPage: React.FC = () => {
  const { getToken } = useAuth();
  const authedApi = useApiWithAuth();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { addToQueue } = useSpeaker();
  const { addToNotificationCount, sendPushNotification } = useNotifications();

  const searchParams = useSearchParams();
  const notificationId = searchParams.get("notification_id");

  const [transcription, setTranscription] = useState<string>("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [outputMode, setOutputMode] = useState<"voice" | "text">("voice");
  const { isRecording, toggleRecording } = useMicrophone();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { messages, addMessage, clearMessages } = useMessageHistory(); // Update this line

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

  const handleIncomingMessage = useCallback(
    (message: string, audioBase64: string | null) => {
      addMessage({ role: "assistant", content: message });

      if (outputMode === "voice" && audioBase64) {
        const binaryString = atob(audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        addToQueue(bytes.buffer);
      }

      setIsLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [addMessage, addToQueue, outputMode]
  );

  const handleActivitiesUpdate = useCallback(
    (
      newActivityEntries: any[],
      notificationText: string,
      reportedMood: boolean
    ) => {
      if ((newActivityEntries.length > 0 || reportedMood) && notificationText) {
        addToNotificationCount(
          newActivityEntries.length + (reportedMood ? 1 : 0)
        );
        toast(notificationText, {
          duration: 5000,
          position: "top-center",
          icon: "📊",
        });
      }
    },
    [addToNotificationCount]
  );

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      console.log("Received message:", data);

      if (data.type === "message") {
        handleIncomingMessage(data.text, data.audio);
      } else if (data.type === "activities_update") {
        handleActivitiesUpdate(
          data.new_activity_entries,
          data.new_activities_notification,
          data.reported_mood
        );
      } else if (data.type === "intermediary_transcription") {
        setTranscription(data.text);
        addMessage({ role: "user", content: `🎙️ ${data.text}` });
      }
    };
  }, [socket, handleIncomingMessage, handleActivitiesUpdate]);

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

  const handleSendMessage = () => {
    if (socket && isConnected) {
      setIsLoading(true);
      socket.send(
        JSON.stringify({
          action: "send_message",
          text: transcription,
          input_mode: inputMode,
          output_mode: outputMode,
        })
      );

      addMessage({ role: "user", content: transcription });
      setTranscription("");

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

  const toggleOutputMode = () => {
    setOutputMode((prevMode) => (prevMode === "voice" ? "text" : "voice"));
  };

  const handleToggleRecording = useCallback(() => {
    toggleRecording((audioData, audioFormat) => {
      if (socket && isConnected) {
        setIsLoading(true);
        socket.send(
          JSON.stringify({
            action: "send_message",
            text: "", // The server will use STT to convert audio to text
            input_mode: "voice",
            output_mode: outputMode,
            audio_data: audioData,
            audio_format: audioFormat,
          })
        );

        // Set timeout for server response
        timeoutRef.current = setTimeout(() => {
          setIsLoading(false);
          toast.error("Server response timed out", {
            position: "top-right",
          });
        }, 20000);
      }
    });
  }, [socket, isConnected, outputMode, toggleRecording]);

  useEffect(() => {
    console.log({ messages });
  }, [messages]);

  useEffect(() => {
    const markNotificationOpened = async () => {
      if (notificationId) {
        try {
          await authedApi.post(
            `/api/mark-notification-opened?notification_id=${notificationId}`
          );
        } catch (error) {
          console.error("Error marking notification as opened:", error);
        }
      }
    };

    markNotificationOpened();
  }, [notificationId, authedApi]);

  return (
    <>
      <AppleLikePopover onClose={() => {}}>
        <h1 className="text-2xl font-bold mb-4">howdy partner 🤠</h1>
        <p className="text-base text-gray-700 mb-4">
          This is an experimental feature and quite buggy, if you&apos;d like to
          use this please please send me your feedback after you do. otherwise
          fuck you bitch freeloader ass
        </p>

      </AppleLikePopover>
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        {isLoading && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
            <LoaderCircle className="animate-spin text-gray-600" size={24} />
          </div>
        )}
        <ChatMessageList className="max-w-xl">
          {messages &&
            messages.length > 0 &&
            messages.map((message, index) => (
              <ChatBubble
                key={index}
                variant={message.role === "assistant" ? "received" : "sent"}
              >
                <ChatBubbleAvatar
                  src={
                    message.role === "assistant"
                      ? "https://htmlcolorcodes.com/assets/images/colors/sky-blue-color-solid-background-1920x1080.png"
                      : "https://htmlcolorcodes.com/assets/images/colors/orange-color-solid-background-1920x1080.png"
                  }
                />
                <ChatBubbleMessage>{message.content}</ChatBubbleMessage>
              </ChatBubble>
            ))}
        </ChatMessageList>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="flex items-center text-red-500 hover:text-red-600 transition-colors"
          >
            <Trash2 size={16} className="mr-1" />
            Clear Messages
          </button>
        )}
        <h1 className="text-2xl mb-4">hi, hyd</h1>
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
        <div className="flex space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={inputMode === "voice"}
              onCheckedChange={toggleInputMode}
              id="input-mode"
            />
            <label htmlFor="input-mode" className="text-sm font-medium">
              {inputMode === "voice" ? (
                <>
                  <Mic className="inline mr-1" size={16} />
                  Voice Input
                </>
              ) : (
                <>
                  <MessageSquare className="inline mr-1" size={16} />
                  Text Input
                </>
              )}
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={outputMode === "voice"}
              onCheckedChange={toggleOutputMode}
              id="output-mode"
            />
            <label htmlFor="output-mode" className="text-sm font-medium">
              {outputMode === "voice" ? (
                <>
                  <Volume2 className="inline mr-1" size={16} />
                  Voice Output
                </>
              ) : (
                <>
                  <VolumeX className="inline mr-1" size={16} />
                  Text Output
                </>
              )}
            </label>
          </div>
        </div>
        {inputMode === "voice" ? (
          <AudioControls
            isRecording={isRecording}
            isConnected={isConnected}
            toggleRecording={handleToggleRecording}
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
              onClick={handleSendMessage}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors w-full"
              disabled={!isConnected}
            >
              Send Message
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default LogPage;
