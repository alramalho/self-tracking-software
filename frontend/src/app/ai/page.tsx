"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useMessageHistory, Message } from "@/hooks/useMessageHistory"; // Add this import
import { useMicrophone } from "@/hooks/useMicrophone";
import { useSpeaker } from "@/hooks/useSpeaker";
import AudioControls from "@/components/AudioControls";
import toast from "react-hot-toast";
import {
  Wifi,
  WifiOff,
  Mic,
  MessageSquare,
  LoaderCircle,
  Volume2,
  VolumeX,
  Trash2,
  Loader2,
  Brain,
  Bell,
  PlusSquare,
  MessageSquarePlus,
  Eclipse,
} from "lucide-react"; // Add this import
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@clerk/nextjs";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiWithAuth } from "@/api";

import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { Switch } from "@/components/ui/switch";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  Activity,
  ActivityEntry,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Users } from "lucide-react";
import { useClipboard } from "@/hooks/useClipboard";
import { useShare } from "@/hooks/useShare";
import FeedbackForm from "@/components/FeedbackForm";
import ActivitySuggestion from "@/components/ActivitySuggestion";
import PlanUpdateBanner, { PlanSession } from "@/components/PlanUpdateBanner";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const REFERRAL_COUNT = 2;

type ExtractedPlanSessions = {
  plan_id: string;
  sessions: PlanSession[];
  old_sessions: PlanSession[];
};

type Emotion = {
  name: string;
  score: number;
  color: string;
};

const LogPage: React.FC = () => {
  const { getToken } = useAuth();
  const authedApi = useApiWithAuth();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { addToQueue, stopAudio } = useSpeaker();
  const { addToNotificationCount, sendPushNotification } = useNotifications();

  const { useUserDataQuery, hasLoadedUserData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");

  function isUserWhitelisted(): boolean {
    if (posthog.isFeatureEnabled("ai-bot-access")) {
      return true;
    }
    return false;
  }

  const searchParams = useSearchParams();
  const notificationId = searchParams.get("notification_id");

  const [transcription, setTranscription] = useState<string>("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [outputMode, setOutputMode] = useState<"voice" | "text">("voice");
  const { isRecording, toggleRecording, cancelRecording } = useMicrophone();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { messages, addMessage, clearMessages } = useMessageHistory(); // Update this line
  const router = useRouter();
  const [isPopoverOpen, setIsPopoverOpen] = useState(true);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const referredUsers = userData?.user?.referred_user_ids.length || 0;
  const [copied, copyToClipboard] = useClipboard();
  const { share, isSupported: isShareSupported } = useShare();

  const [showFeatureForm, setShowFeatureForm] = useState(false);

  const [currentEmotions, setCurrentEmotions] = useState<Emotion[]>([]);
  const [suggestedActivities, setSuggestedActivities] = useState<Activity[]>(
    []
  );
  const [suggestedActivityEntries, setSuggestedActivityEntries] = useLocalStorage<
    ActivityEntry[]
  >("suggested_activity_entries", []);
  const [suggestedNextWeekSessions, setSuggestedNextWeekSessions] = useLocalStorage<
    ExtractedPlanSessions | null
  >("suggested_next_week_sessions", null);

  const connectWebSocket = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        toast.error("No authentication token available");
        return;
      }

      const newSocket = new WebSocket(
        `${process.env.NEXT_PUBLIC_BACKEND_WS_URL!}/ai/connect?token=${token}`
      );

      newSocket.onopen = () => {
        setIsConnected(true);
        toast.success("WebSocket connected");
      };

      newSocket.onclose = (event) => {
        setIsConnected(false);
        if (event.code === 1008) {
          toast.error("Authentication failed");
        } else {
          toast.error("WebSocket disconnected");
        }
      };

      newSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast.error("WebSocket error occurred");
      };

      setSocket(newSocket);
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      toast.error("Failed to connect to WebSocket");
    }
  }, [getToken]);

  useEffect(() => {
    if (isUserWhitelisted()) {
      connectWebSocket();
    }

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

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      console.log("Received message:", data);

      if (data.type === "message") {
        handleIncomingMessage(data.text, data.audio);
      } else if (data.type === "data_update") {
        addToNotificationCount(1);
        toast(data.notification, {
          duration: 5000,
          position: "top-center",
          icon: "📊",
        });
      } else if (data.type === "intermediary_transcription") {
        setTranscription(data.text);
        addMessage({ role: "user", content: `🎙️ ${data.text}` });
      } else if (data.type === "emotion_analysis") {
        setCurrentEmotions(data.result);
      } else if (data.type === "suggested_activity_entries") {
        setSuggestedActivityEntries(data.activity_entries);
        setSuggestedActivities(data.activities);
      } else if (data.type === "suggested_next_week_sessions") {
        setSuggestedNextWeekSessions({
          sessions: data.next_week_sessions,
          old_sessions: data.old_sessions,
          plan_id: data.plan_id,
        } as ExtractedPlanSessions);
      }
    };
  }, [socket, handleIncomingMessage]);

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

  const handleSendMessage = async () => {
    if (socket && isConnected) {
      setIsLoading(true);
      try {
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

        // Increase timeout to 60 seconds
        timeoutRef.current = setTimeout(() => {
          setIsLoading(false);
          toast.error("Server response timed out", {
            position: "top-right",
          });
        }, 60000);
      } catch (error) {
        setIsLoading(false);
        toast.error("Failed to send message");
      }
    }
  };

  const toggleInputMode = () => {
    setInputMode((prevMode) => (prevMode === "voice" ? "text" : "voice"));
  };

  const toggleOutputMode = () => {
    setOutputMode((prevMode) => (prevMode === "voice" ? "text" : "voice"));
  };

  function sendMessage(message: string) {
    setIsLoading(true);
    socket?.send(
      JSON.stringify({
        action: "send_message",
        text: message,
        input_mode: "text",
        output_mode: outputMode,
      })
    );
  }

  const handleToggleRecording = useCallback(() => {
    if (!isRecording) {
      // Stop any ongoing speech when starting to record
      stopAudio();
    }

    toggleRecording((audioData, audioFormat) => {
      if (socket && isConnected) {
        setIsLoading(true);
        socket.send(
          JSON.stringify({
            action: "send_message",
            text: "",
            input_mode: "voice",
            output_mode: outputMode,
            audio_data: audioData,
            audio_format: audioFormat,
          })
        );

        timeoutRef.current = setTimeout(() => {
          setIsLoading(false);
          toast.error("Server response timed out", {
            position: "top-right",
          });
        }, 30000);
      }
    });
  }, [socket, isConnected, outputMode, toggleRecording, stopAudio]);

  useEffect(() => {
    const markNotificationOpened = async () => {
      if (notificationId) {
        try {
          await authedApi.post(
            `/mark-notification-opened?notification_id=${notificationId}`
          );
        } catch (error) {
          console.error("Error marking notification as opened:", error);
        }
      }
    };

    markNotificationOpened();
  }, [notificationId, authedApi]);

  const handleShareReferralLink = async () => {
    const link = `https://app.tracking.so/join/${userData?.user?.username}`;

    try {
      if (isShareSupported) {
        const success = await share(link);
        if (!success) throw new Error("Failed to share");
      } else {
        const success = await copyToClipboard(link);
        if (!success) throw new Error("Failed to copy");
      }
    } catch (error) {
      console.error("Error sharing referral link:", error);
      toast.error("Failed to share referral link. Maybe you cancelled it?");
    }
  };

  const suggestFeature = async (text: string) => {
    await toast.promise(
      authedApi.post("/report-feedback", {
        email: userData?.user?.email || "",
        text,
        type: "feature_request",
      }),
      {
        loading: "Sending feature request...",
        success: "Feature request sent successfully!",
        error: "Failed to send feature request",
      }
    );
  };

  const EmotionBadges: React.FC<{ emotions: Emotion[] }> = ({ emotions }) => {
    if (!emotions.length) return null;

    return (
      <div className="flex gap-2 mt-2 justify-center">
        {emotions.map((emotion, index) => (
          <div
            key={index}
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${emotion.color}15`,
              color: emotion.color,
              border: `1px solid ${emotion.color}30`,
            }}
          >
            {emotion.name} {(emotion.score * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    );
  };

  if (!hasLoadedUserData)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <div className="flex flex-col items-start">
          <p className="text-left">Loading your data...</p>
        </div>
      </div>
    );

  return (
    <>
      {!isUserWhitelisted() && (
        <AppleLikePopover
          className={`z-[10000] ${isPopoverOpen ? "" : "hidden"}`}
          onClose={() => {
            setIsPopoverOpen(false);
          }}
        >
          <h1 className="text-2xl font-bold mb-4">howdy partner 🤠</h1>
          <p className="text-base text-gray-700 mb-4">
            It seems you&apos;re curious about our AI coach. Here&apos;s what it
            does:
          </p>

          <div className="space-y-4 mb-6">
            <div className="flex items-start space-x-3">
              <Brain className="w-10 h-10 text-blue-300 mt-1" />
              <div>
                <h3 className="font-medium">Mood & Emotion extraction</h3>
                <p className="text-sm text-gray-600">
                  Automatically detects and tracks your emotional state from
                  conversations
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <PlusSquare className="w-10 h-10 text-blue-300 mt-1" />
              <div>
                <h3 className="font-medium">Smart Activity Detection</h3>
                <p className="text-sm text-gray-600">
                  Captures and logs activities automatically, even one-off
                  events
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Bell className="w-10 h-10 text-blue-300 mt-1" />
              <div>
                <h3 className="font-medium">Intelligent Notifications</h3>
                <p className="text-sm text-gray-600">
                  Context-aware notification system that knows when to reach out
                </p>
              </div>
            </div>
          </div>

          <p className="text-base text-gray-700 mb-4">
            {`This is a costly feature to run, so I'm limiting access to a few users. If you'd like to use it, please refer ${REFERRAL_COUNT} friends and I'll put you on BETA access.`}
          </p>

          <div className="w-full max-w-sm mx-auto">
            <RadialProgress
              value={referredUsers}
              total={REFERRAL_COUNT}
              title="Referral Progress"
              description="Refer friends to unlock AI features"
              footer={
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {REFERRAL_COUNT - referredUsers} more friends needed
                  </span>
                  <Button variant="secondary" onClick={handleShareReferralLink}>
                    Share Referral Link
                  </Button>
                </div>
              }
            />
            {REFERRAL_COUNT - referredUsers === 0 && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 shadow-sm">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="text-blue-500">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold text-blue-900">
                    You&apos;ve referred enough friends! Request access now.
                  </h3>
                  <p className="text-sm text-blue-700">
                    Tell us how you plan to use the AI feature to get on the
                    list
                  </p>
                  <Button
                    variant="secondary"
                    className="bg-white hover:bg-blue-50"
                    onClick={() => setShowFeatureForm(true)}
                  >
                    <MessageSquarePlus className="w-4 h-4 mr-2" />
                    Request Access
                  </Button>
                </div>
              </div>
            )}
          </div>
        </AppleLikePopover>
      )}
      <div className="flex flex-col min-h-screen">
        <div className="fixed top-4 left-0 right-0 flex justify-center gap-2 z-50">
          <button
            onClick={handleReconnect}
            className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 transition-colors flex items-center gap-2 border border-gray-300 shadow-sm hover:shadow-md active:scale-95"
          >
            {isConnected ? (
              <>
                <Wifi className="text-green-500" size={16} />
                <span className="font-medium">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="text-red-500" size={16} />
                <span className="font-medium">Reconnect</span>
              </>
            )}
          </button>

          <button
            onClick={clearMessages}
            className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 transition-colors flex items-center gap-2 border border-gray-300 shadow-sm hover:shadow-md active:scale-95"
          >
            <Trash2 size={16} />
            <span className="font-medium">Clear</span>
          </button>
        </div>

        <div className="w-full max-w-xl mx-auto mt-12">
          <ChatMessageList>
            {messages.map((message, index) => (
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
                <ChatBubbleMessage message={message.content} />
              </ChatBubble>
            ))}
          </ChatMessageList>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {isLoading && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
              <LoaderCircle className="animate-spin text-gray-600" size={24} />
            </div>
          )}

          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-blue-600 rounded-full mb-8 flex items-center justify-center shadow-lg">
            <Eclipse className="w-12 h-12 text-white" />
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
            <div className="flex flex-col items-center">
              <AudioControls
                isRecording={isRecording}
                isConnected={isConnected}
                toggleRecording={handleToggleRecording}
                cancelRecording={cancelRecording}
                isLoading={isLoading}
              />
              <EmotionBadges emotions={currentEmotions} />
            </div>
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
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isConnected || isLoading}
              >
                {isLoading ? (
                  <>
                    <LoaderCircle className="animate-spin" size={16} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Message</span>
                )}
              </button>
              <EmotionBadges emotions={currentEmotions} />
            </div>
          )}
          {suggestedActivityEntries.map((activityEntry) => {
            const activity = suggestedActivities.find(
              (a) => a.id === activityEntry.activity_id
            );
            if (!activity) return null;
            return (
              <ActivitySuggestion
                key={activityEntry.id}
                activity={activity}
                activityEntry={activityEntry}
                onAccept={(activityEntry, activity) => {
                  setSuggestedActivityEntries(entries => 
                    entries.filter(entry => entry.id !== activityEntry.id)
                  );
                  sendMessage(
                    `I accepted the activity: ${activityEntry.quantity} ${activity.measure} of ${activity.title} in ${activityEntry.date}`
                  );
                }}
                onReject={(activityEntry, activity) => {
                  setSuggestedActivityEntries(entries => 
                    entries.filter(entry => entry.id !== activityEntry.id)
                  );
                  sendMessage(
                    `I rejected the activity: ${activityEntry.quantity} ${activity.measure} of ${activity.title} in ${activityEntry.date}`
                  );
                }}
              />
            );
          })}
          {suggestedNextWeekSessions && suggestedNextWeekSessions.sessions.length > 0 && (
            <PlanUpdateBanner
              sessions={suggestedNextWeekSessions.sessions}
              old_sessions={suggestedNextWeekSessions.old_sessions}
              plan_id={suggestedNextWeekSessions.plan_id}
              onAccept={(sessions) => {
                sendMessage(
                  `I accepted all suggested sessions for the plan: ${sessions
                    .map((s) => s.descriptive_guide)
                    .join(", ")}`
                );
                setSuggestedNextWeekSessions(null);
              }}
              onReject={(sessions) => {
                sendMessage(
                  `I rejected all suggested sessions for the plan: ${sessions
                    .map((s) => s.descriptive_guide)
                    .join(", ")}`
                );
                setSuggestedNextWeekSessions(null);
              }}
            />
          )}
        </div>
      </div>
      {showFeatureForm && (
        <FeedbackForm
          title="✨ Try AI Feature"
          email={userData?.user?.email || ""}
          placeholder="How do you plan to use the AI feature?"
          defaultValue="I want to try the AI because"
          onSubmit={suggestFeature}
          onClose={() => setShowFeatureForm(false)}
        />
      )}
    </>
  );
};

export default LogPage;
