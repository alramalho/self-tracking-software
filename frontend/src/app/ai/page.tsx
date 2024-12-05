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
  Volume2,
  VolumeX,
  Trash2,
  Loader2,
} from "lucide-react"; // Add this import
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiWithAuth } from "@/api";

import { Switch } from "@/components/ui/switch";
import {
  Activity,
  ActivityEntry,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/hooks/useClipboard";
import { useShare } from "@/hooks/useShare";
import FeedbackForm from "@/components/FeedbackForm";
import ActivitySuggestion from "@/components/ActivitySuggestion";
import PlanUpdateBanner, { PlanSession } from "@/components/PlanUpdateBanner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { EmotionBadges } from "@/components/chat/EmotionBadges";
import { ChatInput } from "@/components/chat/ChatInput";
import { AccessRestrictionPopover } from "@/components/chat/AccessRestrictionPopover";

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
  const [suggestedActivityEntries, setSuggestedActivityEntries] =
    useLocalStorage<ActivityEntry[]>("suggested_activity_entries", []);
  const [suggestedNextWeekSessions, setSuggestedNextWeekSessions] =
    useLocalStorage<ExtractedPlanSessions | null>(
      "suggested_next_week_sessions",
      null
    );

  const [showPendingChangesAlert, setShowPendingChangesAlert] = useState(false);

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

  const hasPendingChanges = useCallback(() => {
    return (
      (suggestedActivityEntries && suggestedActivityEntries.length > 0) ||
      (suggestedNextWeekSessions &&
        suggestedNextWeekSessions.sessions.length > 0)
    );
  }, [suggestedActivityEntries, suggestedNextWeekSessions]);

  const clearPendingChanges = useCallback(() => {
    setSuggestedActivityEntries([]);
    setSuggestedNextWeekSessions(null);
  }, [setSuggestedActivityEntries, setSuggestedNextWeekSessions]);

  const handleSendMessage = async () => {
    if (socket && isConnected) {
      if (hasPendingChanges()) {
        setShowPendingChangesAlert(true);
        return;
      }
      sendMessage(transcription);
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

    addMessage({ role: "user", content: message });
    setTranscription("");
  }

  const handleToggleRecording = useCallback(() => {
    if (hasPendingChanges()) {
      setShowPendingChangesAlert(true);
      return;
    }

    if (!isRecording) {
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
  }, [
    socket,
    isConnected,
    outputMode,
    toggleRecording,
    stopAudio,
    hasPendingChanges,
  ]);

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

  const handleActivityAcceptance = async (
    activityEntry: ActivityEntry,
    activity: Activity
  ) => {
    if (!isConnected || !socket) {
      toast.error("Not connected to server");
      return;
    }

    // Remove activity from suggested list
    setSuggestedActivityEntries((entries) =>
      entries.filter((entry) => entry.id !== activityEntry.id)
    );

    // Send acceptance message through WebSocket
    const message = `I accept the activity: ${activityEntry.quantity} ${activity.measure} of ${activity.title} on ${activityEntry.date}`;
    sendMessage(message);
  };

  const handleActivityRejection = async (
    activityEntry: ActivityEntry,
    activity: Activity
  ) => {
    if (!isConnected || !socket) {
      toast.error("Not connected to server");
      return;
    }

    // Remove activity from suggested list
    setSuggestedActivityEntries((entries) =>
      entries.filter((entry) => entry.id !== activityEntry.id)
    );

    // Send rejection message through WebSocket
    const message = `I reject the activity: ${activityEntry.quantity} ${activity.measure} of ${activity.title} on ${activityEntry.date}`;
    sendMessage(message);
  };

  const handleSessionsAcceptance = async (sessions: PlanSession[]) => {
    if (!isConnected || !socket || !suggestedNextWeekSessions) {
      toast.error("Not connected to server");
      return;
    }

    // Clear suggested sessions
    setSuggestedNextWeekSessions(null);

    // Format sessions into readable string
    const sessionsStr = sessions
      .map((session) => {
        const activity = userData?.activities.find(
          (a) => a.id === session.activity_id
        );
        return `${session.quantity} ${activity?.measure} of ${activity?.title} (${session.descriptive_guide})`;
      })
      .join("\n");

    // Send acceptance message through WebSocket
    const message = `I accept the suggested sessions for the plan: \n${sessionsStr}`;
    sendMessage(message);
  };

  const handleSessionsRejection = async (sessions: PlanSession[]) => {
    if (!isConnected || !socket || !suggestedNextWeekSessions) {
      toast.error("Not connected to server");
      return;
    }

    // Clear suggested sessions
    setSuggestedNextWeekSessions(null);

    // Format sessions into readable string
    const sessionsStr = sessions
      .map((session) => {
        const activity = userData?.activities.find(
          (a) => a.id === session.activity_id
        );
        return `${session.quantity} ${activity?.measure} of ${activity?.title} (${session.descriptive_guide})`;
      })
      .join("\n");

    // Send rejection message through WebSocket
    const message = `I reject the suggested sessions for the plan: \n${sessionsStr}`;
    sendMessage(message);
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
        <AccessRestrictionPopover
          isOpen={isPopoverOpen}
          onClose={() => setIsPopoverOpen(false)}
          referredUsers={referredUsers}
          requiredReferrals={REFERRAL_COUNT}
          onShareReferral={handleShareReferralLink}
          onRequestAccess={() => setShowFeatureForm(true)}
        />
      )}
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-col justify-center items-center w-full mx-auto bg-gray-50 border-y border-gray-200">
          <ChatInterface messages={messages} />
          <span className="text-sm text-gray-400 px-4 py-2">Chat (<span onClick={clearMessages} className="text-gray-400 underline cursor-pointer">Clear</span>)</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="bg-gray-50 border-[4px] rounded-full border-gray-700 min-w-[16rem] min-h-[4rem] mb-4 flex items-center justify-between px-4">
            {inputMode === "voice" ? (
              <div className="flex flex-col items-center w-full">
                <AudioControls
                  isRecording={isRecording}
                  isConnected={isConnected}
                  toggleRecording={handleToggleRecording}
                  cancelRecording={cancelRecording}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <div className="flex items-center w-full">
                <ChatInput
                  transcription={transcription}
                  isConnected={isConnected}
                  isLoading={isLoading}
                  onTranscriptionChange={handleTranscriptionChange}
                  onSendMessage={handleSendMessage}
                />
              </div>
            )}
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

          <Button
            variant="ghost"
            onClick={handleReconnect}
            className="hover:bg-transparent"
          >
            {isConnected ? (
              <>
                <Wifi className="text-green-500 mr-2" size={28} />
                <span className="text-xl font-normal italic">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="text-red-500 mr-2" size={28} />
                <span className="text-xl font-normal underline">Reconnect</span>
              </>
            )}
          </Button>

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
                onAccept={handleActivityAcceptance}
                onReject={handleActivityRejection}
              />
            );
          })}
          {suggestedNextWeekSessions &&
            suggestedNextWeekSessions.sessions.length > 0 && (
              <PlanUpdateBanner
                sessions={suggestedNextWeekSessions.sessions}
                old_sessions={suggestedNextWeekSessions.old_sessions}
                plan_id={suggestedNextWeekSessions.plan_id}
                onAccept={handleSessionsAcceptance}
                onReject={handleSessionsRejection}
              />
            )}
        </div>
        <div className="flex flex-col items-center justify-center w-full bg-gray-50 border-y border-gray-200">
          <span className="text-sm text-gray-400 px-4 py-2">
            Emotion Analysis
          </span>
          <EmotionBadges emotions={currentEmotions} />
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
      <AlertDialog
        open={showPendingChangesAlert}
        onOpenChange={setShowPendingChangesAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pending Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Please accept or reject the pending activities/sessions before
              sending new messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowPendingChangesAlert(false)}
            >
              Okay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LogPage;
