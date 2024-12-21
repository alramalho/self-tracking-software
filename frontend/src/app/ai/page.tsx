"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useMessageHistory, Message } from "@/hooks/useMessageHistory"; // Add this import
import { useMicrophone } from "@/hooks/useMicrophone";
import { useSpeaker } from "@/hooks/useSpeaker";
import AudioControls from "@/components/AudioControls";
import toast from "react-hot-toast";
import {
  WifiOff,
  Mic,
  MessageSquare,
  Volume2,
  VolumeX,
  Loader2,
  History,
} from "lucide-react"; // Add this import
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiWithAuth } from "@/api";

import {
  Activity,
  ActivityEntry,
  Emotion,
  useUserPlan,
} from "@/contexts/UserPlanContext";
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
import { useFeatureFlagEnabled } from "posthog-js/react";
import { motion, AnimatePresence } from "framer-motion";
import PlanTimesPerWeekUpdateBanner from "@/components/PlanTimesPerWeekUpdateBanner";

const REFERRAL_COUNT = 2;

type ExtractedPlanSessions = {
  plan_id: string;
  sessions: PlanSession[];
  old_sessions: PlanSession[];
};

type ExtractedTimesPerWeek = {
  plan_id: string;
  old_times_per_week: number;
  new_times_per_week: number;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

const delayTime = 3; // 3 seconds
const messageDisplayVariants = {
  initial: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 1,
  },
  animate: {
    opacity: 0,
    transition: {
      opacity: {
        duration: 0.5,
        delay: delayTime + 0.8,
      },
    },
  },
  exit: {
    opacity: 0,
  },
};

const messageTextVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
  shrink: {
    scale: 0.6,
    y: 0,
    transition: {
      duration: 0.8,
      ease: "easeInOut",
      delay: 2,
    },
  },
};

const connectionStatusVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
    },
  },
};

const LogPage: React.FC = () => {
  const { getToken } = useAuth();
  const authedApi = useApiWithAuth();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { addToQueue, stopAudio } = useSpeaker();
  const { addToNotificationCount, sendPushNotification } = useNotifications();

  const { useUserDataQuery, hasLoadedUserData, messagesData } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");

  const isFeatureEnabled = useFeatureFlagEnabled("ai-bot-access");
  const posthogFeatureFlagsInitialized =
    typeof isFeatureEnabled !== "undefined";
  const [isUserWhitelisted, setIsUserWhitelisted] = useState<boolean>(false);
  const [hasTransitioned, setHasTransitioned] = useState<boolean>(false);

  useEffect(() => {
    if (posthogFeatureFlagsInitialized) {
      setIsUserWhitelisted(isFeatureEnabled);
    }
  }, [posthogFeatureFlagsInitialized, isFeatureEnabled]);

  const searchParams = useSearchParams();
  const notificationId = searchParams.get("notification_id");
  const messageId = searchParams.get("messageId");
  const messageText = searchParams.get("messageText");
  const [isInitialMessageAnimating, setIsInitialMessageAnimating] =
    useState(true);

  const [transcription, setTranscription] = useState<string>("");
  const [outputMode, setOutputMode] = useState<"voice" | "text">("text");
  const { isRecording, toggleRecording, cancelRecording } = useMicrophone();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { messages, addMessage, clearMessages } = useMessageHistory(); // Update this line
  const router = useRouter();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const referredUsers = userData?.user?.referred_user_ids.length || 0;
  const [copied, copyToClipboard] = useClipboard();
  const { share, isSupported: isShareSupported } = useShare();

  const [showFeatureForm, setShowFeatureForm] = useState(false);

  const [currentEmotions, setCurrentEmotions] = useState<Emotion[]>([]);
  const [suggestedActivities, setSuggestedActivities] = useLocalStorage<
    Activity[]
  >("suggested_activities", []);
  const [suggestedActivityEntries, setSuggestedActivityEntries] =
    useLocalStorage<ActivityEntry[]>("suggested_activity_entries", []);
  const [suggestedNextWeekSessions, setSuggestedNextWeekSessions] =
    useLocalStorage<ExtractedPlanSessions | null>(
      "suggested_next_week_sessions",
      null
    );
  const [suggestedTimesPerWeek, setSuggestedTimesPerWeek] =
    useLocalStorage<ExtractedTimesPerWeek | null>(
      "suggested_times_per_week",
      null
    );

  const [showPendingChangesAlert, setShowPendingChangesAlert] = useState(false);

  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const [pendingActivityResponses, setPendingActivityResponses] = useState<{
    accepted: { activity: Activity; entry: ActivityEntry }[];
    rejected: { activity: Activity; entry: ActivityEntry }[];
  }>({ accepted: [], rejected: [] });

  const connectWebSocket = useCallback(async () => {
    try {
      setIsConnecting(true);
      const token = await getToken();
      if (!token) {
        toast.error("No authentication token available");
        setIsConnecting(false);
        return;
      }

      const newSocket = new WebSocket(
        `${process.env.NEXT_PUBLIC_BACKEND_WS_URL!}/ai/connect?token=${token}`
      );

      newSocket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
      };

      newSocket.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        setIsLoading(false);
        if (event.code === 1008) {
          toast.error("Authentication failed");
        } else {
          toast.error("WebSocket disconnected");
        }
      };

      newSocket.onerror = (error) => {
        setIsConnecting(false);
        setIsLoading(false);
        toast.error("WebSocket error occurred");
      };

      setSocket(newSocket);
    } catch (error) {
      setIsConnecting(false);
      toast.error("Failed to connect to WebSocket");
    }
  }, [getToken]);

  useEffect(() => {
    if (isUserWhitelisted) {
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
    messagesData.refetch();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

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
      } else if (data.type === "suggested_times_per_week") {
        setSuggestedTimesPerWeek({
          new_times_per_week: data.times_per_week,
          old_times_per_week: data.old_times_per_week,
          plan_id: data.plan_id,
        } as ExtractedTimesPerWeek);
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
        suggestedNextWeekSessions.sessions.length > 0) ||
      (suggestedTimesPerWeek &&
        suggestedTimesPerWeek.new_times_per_week !==
          suggestedTimesPerWeek.old_times_per_week)
    );
  }, [
    suggestedActivityEntries,
    suggestedNextWeekSessions,
    suggestedTimesPerWeek,
  ]);

  const handleSendMessage = async () => {
    if (socket && isConnected) {
      if (hasPendingChanges()) {
        setShowPendingChangesAlert(true);
        return;
      }
      sendMessage(transcription);
    } else {
      setIsLoading(false);
      toast.error("Not connected to server");
    }
  };

  const toggleOutputMode = () => {
    setOutputMode((prevMode) => (prevMode === "voice" ? "text" : "voice"));
    stopAudio();
  };

  function sendMessage(message: string, visible: boolean = true) {
    setIsLoading(true);
    socket?.send(
      JSON.stringify({
        action: "send_message",
        text: message,
        input_mode: "text",
        output_mode: outputMode,
      })
    );

    if (visible) {
      addMessage({ role: "user", content: message });
    }
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
          toast.error(`Error marking notification as opened: ${error}`);
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

  function toReadableDate(date: string) {
    return new Date(date)
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      .replace(",", "");
  }

  const handleActivityAcceptance = async (
    activityEntry: ActivityEntry,
    activity: Activity
  ) => {
    if (!isConnected || !socket) {
      toast.error("Not connected to server");
      return;
    }

    await authedApi.post("/log-activity", {
      activity_id: activity.id,
      iso_date_string: activityEntry.date,
      quantity: activityEntry.quantity,
      has_photo: false,
    });

    setPendingActivityResponses((prev) => ({
      ...prev,
      accepted: [...prev.accepted, { activity, entry: activityEntry }],
    }));

    setSuggestedActivityEntries((entries) =>
      entries.filter((entry) => entry.id !== activityEntry.id)
    );

    if (suggestedActivityEntries.length === 1) {
      const acceptedActivitiesStr = [
        ...pendingActivityResponses.accepted,
        { activity, entry: activityEntry },
      ]
        .map(
          ({ activity, entry }) =>
            `${entry.quantity} ${activity.measure} '${
              activity.title
            }' in ${toReadableDate(entry.date)}`
        )
        .join("\n - ");

      const rejectedActivitiesStr = pendingActivityResponses.rejected
        .map(
          ({ activity, entry }) =>
            `${entry.quantity} ${activity.measure} '${
              activity.title
            }' in ${toReadableDate(entry.date)}`
        )
        .join("\n - ");

      let message = "";
      if (acceptedActivitiesStr) {
        message += `User accepted and logged the following activities:\n${acceptedActivitiesStr}\n`;
      }
      if (rejectedActivitiesStr) {
        message += `User rejected the following activities:\n${rejectedActivitiesStr}`;
      }

      await authedApi.post("/ai/send-system-message", { message });
      sendMessage("done!", false);

      setPendingActivityResponses({ accepted: [], rejected: [] });
    }
  };

  const handleTimesPerWeekAcceptance = async () => {
    if (!isConnected || !socket) {
      toast.error("Not connected to server");
      return;
    }

    const oldTimesPerWeek = suggestedTimesPerWeek?.old_times_per_week;
    const newTimesPerWeek = suggestedTimesPerWeek?.new_times_per_week;
    const planId = suggestedTimesPerWeek?.plan_id;

    await authedApi.post(`/plans/${planId}/update`, {
      data: {
        times_per_week: newTimesPerWeek,
      },
    });

    await authedApi.post("/ai/send-system-message", {
      message: `User accepted the changes of ${oldTimesPerWeek} to ${newTimesPerWeek} times per week`,
    });
    sendMessage("done!", false);

    setSuggestedTimesPerWeek(null);
  };

  const handleTimesPerWeekRejection = async () => {
    const oldTimesPerWeek = suggestedTimesPerWeek?.old_times_per_week;
    const newTimesPerWeek = suggestedTimesPerWeek?.new_times_per_week;

    await authedApi.post("/ai/send-system-message", {
      message: `User rejected the changes of ${oldTimesPerWeek} to ${newTimesPerWeek} times per week`,
    });
    sendMessage("done!", false);

    setSuggestedTimesPerWeek(null);
  };

  const handleActivityRejection = async (
    activityEntry: ActivityEntry,
    activity: Activity
  ) => {
    if (!isConnected || !socket) {
      toast.error("Not connected to server");
      return;
    }

    setPendingActivityResponses((prev) => ({
      ...prev,
      rejected: [...prev.rejected, { activity, entry: activityEntry }],
    }));

    setSuggestedActivityEntries((entries) =>
      entries.filter((entry) => entry.id !== activityEntry.id)
    );

    if (suggestedActivityEntries.length === 1) {
      const acceptedActivitiesStr = pendingActivityResponses.accepted
        .map(
          ({ activity, entry }) =>
            `${entry.quantity} ${activity.measure} of ${
              activity.title
            } in ${toReadableDate(entry.date)}`
        )
        .join("\n");

      const rejectedActivitiesStr = [
        ...pendingActivityResponses.rejected,
        { activity, entry: activityEntry },
      ]
        .map(
          ({ activity, entry }) =>
            `${entry.quantity} ${activity.measure} of ${
              activity.title
            } in ${toReadableDate(entry.date)}`
        )
        .join("\n");

      let message = "";
      if (acceptedActivitiesStr) {
        message += `User accepted and logged the following activities:\n${acceptedActivitiesStr}\n`;
      }
      if (rejectedActivitiesStr) {
        message += `User rejected the following activities:\n${rejectedActivitiesStr}`;
      }

      await authedApi.post("/ai/send-system-message", { message });
      sendMessage("done!", false);
      setPendingActivityResponses({ accepted: [], rejected: [] });
    }
  };

  const handleSessionsAcceptance = async (sessions: PlanSession[]) => {
    if (!isConnected || !socket || !suggestedNextWeekSessions) {
      toast.error("Not connected to server");
      return;
    }

    setSuggestedNextWeekSessions(null);

    const sessionsStr = sessions
      .map((session) => {
        const activity = userData?.activities.find(
          (a) => a.id === session.activity_id
        );
        return `${session.quantity} ${activity?.measure} of ${
          activity?.title
        } (${session.descriptive_guide}) in ${toReadableDate(session.date)}`;
      })
      .join("\n");

    const message = `User accepted the suggested sessions for the plan: \n${sessionsStr}`;
    await authedApi.post("/ai/send-system-message", { message });
    sendMessage("done!", false);
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
        return `${session.quantity} ${activity?.measure} of ${
          activity?.title
        } (${session.descriptive_guide}) in ${toReadableDate(session.date)}`;
      })
      .join("\n");

    const message = `User rejected the suggested sessions for the plan: \n${sessionsStr}`;
    await authedApi.post("/ai/send-system-message", { message });
    sendMessage("done!", false);
  };

  useEffect(() => {
    if (!hasTransitioned && messageId && messageText && messagesData.isSuccess) {
      setTimeout(() => {
        clearMessages();
        if (messagesData.data?.messages) {
          messagesData.data.messages
            .slice(0, 1)
            .map((message) => ({
              role:
                message.sender_id === userData?.user?.id ? "user" : "assistant",
              content: message.text,
            }))
            .forEach((message) => {
              addMessage(message as Message);
            });
        }
        setIsInitialMessageAnimating(false);
        handleReconnect();
        setHasTransitioned(true);
      }, (delayTime + 1.4) * 1000); // delayTime + height animation + fade duration + small buffer
    } else if (!messageId && !messageText) {
      setIsInitialMessageAnimating(false);
    }
  }, [messageId, messageText, messagesData.isSuccess, messagesData.data]);

  if (!hasLoadedUserData)
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <div className="flex flex-col items-start">
          <p className="text-left">Loading your data...</p>
        </div>
      </div>
    );

  return (
    <>
      {!isUserWhitelisted && (
        <AccessRestrictionPopover
          isOpen={true}
          onClose={() => router.back()}
          referredUsers={referredUsers}
          requiredReferrals={REFERRAL_COUNT}
          onShareReferral={handleShareReferralLink}
          onRequestAccess={() => setShowFeatureForm(true)}
        />
      )}
      {isUserWhitelisted && (
        <>
          <AnimatePresence>
            {messageId && messageText && isInitialMessageAnimating ? (
              <motion.div
                variants={messageDisplayVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="fixed inset-0 bg-gray-50 z-110 px-4"
              >
                <motion.div
                  variants={messageTextVariants}
                  initial="initial"
                  animate="animate"
                  className="max-w-2xl mx-auto text-xl text-center"
                >
                  {decodeURIComponent(messageText)}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                className="h-full flex flex-col justify-between bg-gray-100"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div
                  variants={itemVariants}
                  className="relative min-h-[150px] max-h-[550px] overflow-y-auto m-2 border border-gray-200 rounded-lg shadow-sm"
                >
                  <Button
                    variant="ghost"
                    className="text-gray-500 underline w-full"
                    onClick={() => router.push("/message-history")}
                  >
                    <History className="w-4 h-4 mr-2" />
                    See full history
                  </Button>
                  <div className="w-full">
                    <p className="text-gray-500 text-md leading-[15px] mx-auto text-center">
                      ...
                    </p>
                  </div>
                  <ChatInterface messages={messages.slice(-2)} />
                </motion.div>

                <motion.div className="flex flex-col items-center justify-center">
                  <EmotionBadges emotions={currentEmotions} />
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className={`flex-1 flex flex-col items-center justify-center gap-4 p-4 ${
                    suggestedActivityEntries.length > 0 ? "mb-4" : ""
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {!isConnected ? (
                      <motion.div
                        key="disconnected"
                        variants={connectionStatusVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <Button
                          variant="ghost"
                          onClick={handleReconnect}
                          className="hover:bg-transparent"
                        >
                          {isConnecting ? (
                            <>
                              <Loader2
                                className="animate-spin text-gray-500 mr-2"
                                size={28}
                              />
                              <span className="text-xl font-normal italic">
                                Connecting...
                              </span>
                            </>
                          ) : (
                            <>
                              <WifiOff
                                className="text-red-500 mr-2"
                                size={28}
                              />
                              <span className="text-xl font-normal underline">
                                Connect
                              </span>
                            </>
                          )}
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="connected"
                        variants={connectionStatusVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-row items-center justify-between w-full max-w-full"
                      >
                        <div className="border-[4px] bg-white shadow-inner rounded-full border-gray-700 w-full max-w-[600px] min-w-[220px] min-h-[4rem] flex items-center justify-between">
                          <ChatInput
                            transcription={transcription}
                            isConnected={isConnected}
                            isLoading={isLoading}
                            isRecording={isRecording}
                            onTranscriptionChange={handleTranscriptionChange}
                            onSendMessage={handleSendMessage}
                            onToggleRecording={handleToggleRecording}
                            onCancelRecording={cancelRecording}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {outputMode !== "voice" && (
                    <div className="text-center -mt-1 mb-2">
                      <span className="text-xs text-gray-400">
                        ⚠️ Emotion analysis only available on voice mode
                      </span>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className="flex flex-col gap-4 px-4 mb-4"
                >
                  {suggestedActivityEntries.map((activityEntry) => {
                    const activity = suggestedActivities.find(
                      (a) => a.id === activityEntry.activity_id
                    );
                    if (!activity) return null;
                    return (
                      <ActivitySuggestion
                        key={activityEntry.id}
                        activity={activity}
                        disabled={!isConnected}
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

                  {suggestedTimesPerWeek && (
                    <PlanTimesPerWeekUpdateBanner
                      times_per_week={suggestedTimesPerWeek.new_times_per_week}
                      old_times_per_week={
                        suggestedTimesPerWeek.old_times_per_week
                      }
                      plan={userData?.plans.find(
                        (p) => p.id === suggestedTimesPerWeek.plan_id
                      )}
                      onAccept={handleTimesPerWeekAcceptance}
                      onReject={handleTimesPerWeekRejection}
                    />
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
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
      )}
    </>
  );
};

export default LogPage;
