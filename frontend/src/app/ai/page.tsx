// "use client";

// import React, {
//   useEffect,
//   useState,
//   useCallback,
//   useRef,
//   useMemo,
// } from "react";
// import { useMessageHistory, Message } from "@/hooks/useMessageHistory";
// import { FinishedCallback, useMicrophone } from "@/hooks/useMicrophone";
// import { useSpeaker } from "@/hooks/useSpeaker";
// import { useRive, useStateMachineInput } from "@rive-app/react-canvas-lite";
// import toast from "react-hot-toast";
// import {
//   WifiOff,
//   Mic,
//   MessageSquare,
//   Volume2,
//   VolumeX,
//   Loader2,
//   History,
// } from "lucide-react";
// import { useNotifications } from "@/hooks/useNotifications";
// import { useAuth } from "@clerk/nextjs";
// import { useRouter, useSearchParams } from "next/navigation";
// import { useApiWithAuth } from "@/api";
// import { Emotion, useUserPlan } from "@/contexts/UserPlanContext";
// import { Button } from "@/components/ui/button";
// import { useClipboard } from "@/hooks/useClipboard";
// import { useShare } from "@/hooks/useShare";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog";
// import { ChatInterface } from "@/components/chat/ChatInterface";
// import { EmotionBadges } from "@/components/chat/EmotionBadges";
// import { ChatInput } from "@/components/chat/ChatInput";
// import { AccessRestrictionPopover } from "@/components/chat/AccessRestrictionPopover";
// import { useFeatureFlagEnabled } from "posthog-js/react";
// import posthog from "posthog-js";
// import { motion, AnimatePresence } from "framer-motion";
// import { SuggestionContainer } from "@/components/SuggestionContainer";
// import { SuggestionBase } from "@/types/suggestions";
// import { activitySuggestionHandler } from "@/suggestions/activitySuggestion";
// import { metricSuggestionHandler } from "@/suggestions/metricSuggestion";
// import { suggestionRegistry } from "@/lib/suggestionRegistry";
// import {
//   PlanBuildingContainer,
//   CompletePlan,
// } from "@/components/PlanBuildingContainer";
// import { VoiceModeInput } from "@/components/chat/VoiceModeInput";
// import { UpgradePopover } from "@/components/UpgradePopover";
// import { usePaidPlan } from "@/hooks/usePaidPlan";
// import { PlanCreatorDynamicUI } from "@/components/PlanCreatorDynamicUI";

// const REFERRAL_COUNT = 2;

// const containerVariants = {
//   hidden: { opacity: 0 },
//   visible: {
//     opacity: 1,
//     transition: {
//       staggerChildren: 0.3,
//     },
//   },
// };

// const itemVariants = {
//   hidden: { opacity: 0, y: 20 },
//   visible: {
//     opacity: 1,
//     y: 0,
//     transition: {
//       duration: 0.5,
//       ease: "easeOut",
//     },
//   },
// };

// const delayTime = 3; // 3 seconds
// const messageDisplayVariants = {
//   initial: {
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     opacity: 1,
//   },
//   animate: {
//     opacity: 0,
//     transition: {
//       opacity: {
//         duration: 0.5,
//         delay: delayTime + 0.8,
//       },
//     },
//   },
//   exit: {
//     opacity: 0,
//   },
// };

// const messageTextVariants = {
//   initial: { opacity: 0, scale: 0.8 },
//   animate: {
//     opacity: 1,
//     scale: 1,
//     transition: {
//       duration: 0.5,
//       ease: "easeOut",
//     },
//   },
//   shrink: {
//     scale: 0.6,
//     y: 0,
//     transition: {
//       duration: 0.8,
//       ease: "easeInOut",
//       delay: 2,
//     },
//   },
// };

// const connectionStatusVariants = {
//   initial: { opacity: 0, y: 20 },
//   animate: {
//     opacity: 1,
//     y: 0,
//     transition: {
//       duration: 0.3,
//       ease: "easeOut",
//     },
//   },
//   exit: {
//     opacity: 0,
//     y: -20,
//     transition: {
//       duration: 0.2,
//     },
//   },
// };

// type AssistantType =
//   | "activity-extraction"
//   | "plan-creation"
//   | "metrics-companion";

// const LogPage: React.FC = () => {
//   const { getToken } = useAuth();
//   const authedApi = useApiWithAuth();

//   const [isConnected, setIsConnected] = useState<boolean>(false);
//   const [socket, setSocket] = useState<WebSocket | null>(null);
//   const [startTime, setStartTime] = useState<number | null>(null);
//   const { addToQueue, stopAudio, isPlaying: isAISpeaking } = useSpeaker();
//   const { addToNotificationCount, sendPushNotification } = useNotifications();
//   const { isRecording, toggleRecording, cancelRecording } = useMicrophone();

//   const { useCurrentUserDataQuery, messagesData } = useUserPlan();
//   const currentUserDataQuery = useCurrentUserDataQuery();
//   const { data: userData } = currentUserDataQuery;
//   const { userPaidPlanType } = usePaidPlan();

//   const isUserWhitelisted = userPaidPlanType === "supporter"
//   const [hasTransitioned, setHasTransitioned] = useState<boolean>(false);
//   const [areEmotionsLoading, setAreEmotionsLoading] = useState<boolean>(false);


//   const searchParams = useSearchParams();
//   const notificationId = searchParams.get("notification_id");
//   let assistantType: AssistantType = searchParams.get(
//     "assistantType"
//   ) as AssistantType;
//   if (!assistantType) {
//     assistantType = "activity-extraction";
//   }
//   const messageId = searchParams.get("messageId");
//   const messageText = searchParams.get("messageText");
//   const [isInitialMessageAnimating, setIsInitialMessageAnimating] =
//     useState(true);

//   const [transcription, setTranscription] = useState<string>("");
//   const [outputMode, setOutputMode] = useState<"voice" | "text">("text");
//   const [isLoading, setIsLoading] = useState<boolean>(false);
//   const { messages, addMessage, clearMessages } = useMessageHistory();
//   const router = useRouter();

//   const timeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const emotionLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const referredUsers = userData?.user?.referred_user_ids.length || 0;
//   const [copied, copyToClipboard] = useClipboard();
//   const { share, isSupported: isShareSupported } = useShare();

//   const [currentEmotions, setCurrentEmotions] = useState<Emotion[]>([]);
//   const [suggestions, setSuggestions] = useState<SuggestionBase[]>([]);
//   const [showPendingChangesAlert, setShowPendingChangesAlert] = useState(false);
//   const [isConnecting, setIsConnecting] = useState<boolean>(false);
//   const [isVoiceMode, setIsVoiceMode] = useState(false);

//   const api = useApiWithAuth();

//   const { rive, RiveComponent } = useRive({
//     src: "/animations/ai_voice_states.riv",
//     stateMachines: "State",
//     autoplay: true,
//   });

//   const numberStateTransition = useStateMachineInput(
//     rive,
//     "State",
//     "number",
//     0
//   );

//   useEffect(() => {
//     if (messageId && messageText) {
//       api.post(`/messages/${messageId}/move-up`);
//     }
//   }, []);

//   useEffect(() => {
//     if (!numberStateTransition) return;

//     if (isRecording) {
//       numberStateTransition.value = 2;
//     } else if (isAISpeaking) {
//       numberStateTransition.value = 1;
//     } else if (isLoading) {
//       numberStateTransition.value = 0;
//     } else {
//       numberStateTransition.value = 3;
//     }
//   }, [isRecording, isAISpeaking, numberStateTransition, isLoading]);

//   const handleToggleRecording = (onFinished: FinishedCallback) => {
//     stopAudio();
//     toggleRecording(onFinished);
//   };

//   const connectWebSocket = async () => {
//     try {
//       setIsConnecting(true);
//       const token = await getToken();
//       if (!token) {
//         toast.error("No authentication token available");
//         setIsConnecting(false);
//         return;
//       }

//       const newSocket = new WebSocket(
//         `${process.env
//           .NEXT_PUBLIC_BACKEND_WS_URL!}/ai/connect-${assistantType}?token=${token}`
//       );

//       newSocket.onopen = () => {
//         setIsConnected(true);
//         setIsConnecting(false);
//       };

//       newSocket.onclose = (event) => {
//         setIsConnected(false);
//         setIsConnecting(false);
//         setIsLoading(false);
//         if (event.code === 1008) {
//           toast.error("Authentication failed");
//         } else {
//           toast.error("WebSocket disconnected");
//         }

//       };

//       newSocket.onerror = (error) => {
//         setIsConnecting(false);
//         setIsLoading(false);
//         console.error("WebSocket error occurred", error);
//       };

//       setSocket(newSocket);
//     } catch (error) {
//       setIsConnecting(false);
//       toast.error("Failed to connect to WebSocket");
//     }
//   };

//   useEffect(() => {
//     if (isUserWhitelisted) {
//       connectWebSocket();
//     }

//     return () => {
//       if (socket) {
//         socket.close();
//       }
//     };
//   }, []);

//   const handleIncomingMessage = useCallback(
//     (message: string, audioBase64: string | null) => {
//       addMessage({ role: "assistant", content: message });

//       if (outputMode === "voice" && audioBase64) {
//         const binaryString = atob(audioBase64);
//         const len = binaryString.length;
//         const bytes = new Uint8Array(len);
//         for (let i = 0; i < len; i++) {
//           bytes[i] = binaryString.charCodeAt(i);
//         }
//         addToQueue(bytes.buffer);
//       }

//       setIsLoading(false);
//       if (timeoutRef.current) {
//         clearTimeout(timeoutRef.current);
//       }
//     },
//     [addMessage, addToQueue, outputMode]
//   );
//   useEffect(() => {
//     messagesData.refetch();
//   }, [messages]);

//   useEffect(() => {
//     if (!socket) return;

//     socket.onmessage = (event: MessageEvent) => {
//       const data = JSON.parse(event.data);

//       if (data.type === "message") {
//         // Calculate latency if we have a start time
//         if (startTime !== null) {
//           const endTime = performance.now();
//           const latencySeconds = (endTime - startTime) / 1000;
          
//           // Track latency in PostHog
//           const inputMode = isVoiceMode ? 'voice' : 'text';
//           const eventName = `ai-conversation-${inputMode}-to-${outputMode}-latency`;
          
//           posthog?.capture(
//             eventName,
//             {
//               latency_seconds: Math.round(latencySeconds * 1000) / 1000,
//               input_mode: inputMode,
//               output_mode: outputMode,
//               assistant_type: assistantType,
//             }
//           );
//           setStartTime(null);
//         }

//         handleIncomingMessage(data.text, data.audio);
//       } else if (data.type === "data_update") {
//         addToNotificationCount(1);
//         toast(data.notification, {
//           duration: 5000,
//           position: "top-center",
//           icon: "📊",
//         });
//       } else if (data.type === "intermediary_transcription") {
//         setTranscription(data.text);
//         addMessage({ role: "user", content: `🎙️ ${data.text}` });
//       } else if (data.type === "emotion_analysis") {
//         const receivedEmotions = data.result;
//         console.log({ receivedEmotions, currentEmotions });
//         console.log(
//           JSON.stringify(receivedEmotions) !== JSON.stringify(currentEmotions)
//         );

//         if (
//           JSON.stringify(receivedEmotions) !== JSON.stringify(currentEmotions)
//         ) {
//           setCurrentEmotions(receivedEmotions);
//           setAreEmotionsLoading(false);
//         }
//         if (emotionLoadingTimeoutRef.current) {
//           clearTimeout(emotionLoadingTimeoutRef.current);
//         }
//       } else if (data.type === "suggestions") {
//         setSuggestions((prev) => [...prev, ...data.suggestions]);
//       }
//     };
//   }, [socket, startTime, handleIncomingMessage, isVoiceMode, outputMode, assistantType]);

//   const handleReconnect = () => {
//     if (socket) {
//       socket.close();
//     }
//     connectWebSocket();
//   };

//   const handleTranscriptionChange = (
//     e: React.ChangeEvent<HTMLTextAreaElement>
//   ) => {
//     setTranscription(e.target.value);
//   };

//   const hasPendingChanges = useCallback(() => {
//     return suggestions.some((s) => {
//       switch (s.type) {
//         case "activity":
//         case "plan_sessions":
//           return true; // These require explicit accept/reject actions
//         case "plan_goal":
//         case "plan_activities":
//         case "plan_type":
//           return false; // These are informational, no action required
//         default:
//           return false;
//       }
//     });
//   }, [suggestions]);

//   const handleSendMessage = async (text: string) => {
//     if (socket && isConnected) {
//       if (hasPendingChanges()) {
//         setShowPendingChangesAlert(true);
//         return;
//       }
//       sendMessage(text);
//     } else {
//       setIsLoading(false);
//       toast.error("Not connected to server");
//     }
//   };

//   function sendMessage(message: string, visible: boolean = true) {
//     setIsLoading(true);
//     // Set start time for latency tracking
//     setStartTime(performance.now());
    
//     socket?.send(
//       JSON.stringify({
//         action: "send_message",
//         text: message,
//         input_mode: isVoiceMode ? "voice" : "text",
//         output_mode: outputMode,
//       })
//     );

//     if (visible) {
//       addMessage({ role: "user", content: message });
//     }
//     setTranscription("");
//   }

//   const handleVoiceSent = (audioData: string, audioFormat: string) => {
//     if (hasPendingChanges()) {
//       setShowPendingChangesAlert(true);
//       return;
//     }
//     if (socket && isConnected) {
//       setIsLoading(true);
//       setAreEmotionsLoading(true); // voice always triggers emotion analysis
//       socket.send(
//         JSON.stringify({
//           action: "send_message",
//           text: "",
//           input_mode: "voice",
//           output_mode: outputMode,
//           audio_data: audioData,
//           audio_format: audioFormat,
//         })
//       );

//       emotionLoadingTimeoutRef.current = setTimeout(() => {
//         setAreEmotionsLoading(false);
//       }, 30000);
//       timeoutRef.current = setTimeout(() => {
//         setIsLoading(false);
//         toast.error("Server response timed out", {
//           position: "top-right",
//         });
//       }, 30000);
//     }
//   };

//   useEffect(() => {
//     const markNotificationOpened = async () => {
//       if (notificationId) {
//         try {
//           await authedApi.post(
//             `/mark-notification-opened?notification_id=${notificationId}`
//           );
//         } catch (error) {
//           toast.error(`Error marking notification as opened: ${error}`);
//         }
//       }
//     };

//     markNotificationOpened();
//   }, [notificationId, authedApi]);


//   const handleSuggestionHandled = (handled: SuggestionBase) => {
//     setSuggestions((prev) => prev.filter((s) => s.id !== handled.id));
//     sendMessage(`done!`);
//   };

//   useEffect(() => {
//     if (
//       !hasTransitioned &&
//       messageId &&
//       messageText &&
//       messagesData.isSuccess
//     ) {
//       setTimeout(() => {
//         clearMessages();
//         if (messagesData.data?.messages) {
//           messagesData.data.messages
//             .slice(0, 1)
//             .map((message) => ({
//               role:
//                 message.sender_id === userData?.user?.id ? "user" : "assistant",
//               content: message.text,
//             }))
//             .forEach((message) => {
//               addMessage(message as Message);
//             });
//         }
//         setIsInitialMessageAnimating(false);
//         handleReconnect();
//         setHasTransitioned(true);
//       }, (delayTime + 1.4) * 1000); // delayTime + height animation + fade duration + small buffer
//     } else if (!messageId && !messageText) {
//       setIsInitialMessageAnimating(false);
//     }
//   }, [messageId, messageText, messagesData.isSuccess, messagesData.data]);

//   useEffect(() => {
//     suggestionRegistry.register(activitySuggestionHandler);
//     suggestionRegistry.register(metricSuggestionHandler);

//     return () => {
//       suggestionRegistry.clear();
//     };
//   }, []);

//   const activitySuggestions = useMemo(
//     () => suggestions.filter((s) => s.type === "activity"),
//     [suggestions]
//   );

//   const metricSuggestions = useMemo(
//     () => suggestions.filter((s) => s.type === "metric"),
//     [suggestions]
//   );

//   const planSuggestions = useMemo(
//     () => suggestions.filter((s) => s.type.startsWith("plan_")),
//     [suggestions]
//   );

//   const handlePlanAccepted = async (plan: CompletePlan) => {
//     try {
//       await authedApi.post("/create-plan", plan);

//       await authedApi.post("/ai/send-system-message", {
//         message: `User accepted the plan with goal: ${plan.goal}`,
//       });

//       setSuggestions((prev) => prev.filter((s) => !s.type.startsWith("plan_")));

//       sendMessage("Great, I've accepted the plan!", false);
//     } catch (error) {
//       toast.error("Failed to create plan");
//       throw error;
//     }
//   };

//   const handlePlanRejected = async () => {
//     try {
//       await authedApi.post("/ai/send-system-message", {
//         message: "User rejected the plan creation",
//       });

//       setSuggestions((prev) => prev.filter((s) => !s.type.startsWith("plan_")));

//       sendMessage(
//         "I don't want to create this plan. Let's try something else.",
//         false
//       );
//     } catch (error) {
//       toast.error("Failed to reject plan");
//       throw error;
//     }
//   };

//   const handleVoiceModeToggle = () => {
//     setIsVoiceMode((prev) => !prev);
//     stopAudio();
//   };

//   useEffect(() => {
//     if (isVoiceMode) {
//       setOutputMode("voice");
//     } else {
//       setOutputMode("text");
//     }
//   }, [isVoiceMode]);

//   return (
//     <>
//       {!isUserWhitelisted && (
//         <UpgradePopover
//           open={true}
//           onClose={() => router.back()}
//         />
//       )}
//       {isUserWhitelisted && (
//         <>
//           <AnimatePresence>
//             {messageId && messageText && isInitialMessageAnimating ? (
//               <motion.div
//                 variants={messageDisplayVariants}
//                 initial="initial"
//                 animate="animate"
//                 exit="exit"
//                 className="fixed inset-0 bg-gray-50 z-110 px-4"
//               >
//                 <motion.div
//                   variants={messageTextVariants}
//                   initial="initial"
//                   animate="animate"
//                   className="max-w-2xl mx-auto text-xl text-center"
//                 >
//                   {decodeURIComponent(messageText)}
//                 </motion.div>
//               </motion.div>
//             ) : (
//               <motion.div
//                 className="h-full flex flex-col justify-between bg-gray-100"
//                 variants={containerVariants}
//                 initial="hidden"
//                 animate="visible"
//               >
//                 {/* Assistant type title */}
//                 <div className="text-center py-2">
//                   <h2 className="text-lg font-medium text-gray-700">
//                     Talking to{" "}
//                     {assistantType
//                       .split("-")
//                       .map(
//                         (word) => word.charAt(0).toUpperCase() + word.slice(1)
//                       )
//                       .join(" ")}{" "}
//                     ⭐️
//                   </h2>
//                 </div>
//                 {isVoiceMode && (
//                   <>
//                     <div className="flex flex-col items-center justify-center w-full h-full">
//                       <motion.div
//                         initial={{ opacity: 0 }}
//                         animate={{ opacity: 1 }}
//                         transition={{ delay: 0.35, duration: 0.6 }}
//                       >
//                         <div className="flex flex-col items-center justify-center w-[200px] h-[200px]">
//                           <RiveComponent />
//                         </div>
//                       </motion.div>
//                     </div>
//                   </>
//                 )}

//                 {!isVoiceMode && (
//                   <motion.div
//                     variants={itemVariants}
//                     className="relative bg-white min-h-[150px] max-h-[550px] overflow-y-auto m-2 border border-gray-200 rounded-lg shadow-sm"
//                   >
//                     <Button
//                       variant="ghost"
//                       className="text-gray-500 underline w-full"
//                       onClick={() => router.push("/message-history")}
//                     >
//                       <History className="w-4 h-4 mr-2" />
//                       See full history
//                     </Button>
//                     <div className="w-full">
//                       <p className="text-gray-500 text-md leading-[15px] mx-auto text-center">
//                         ...
//                       </p>
//                     </div>
//                     <ChatInterface messages={messages.slice(-2)} />
//                   </motion.div>
//                 )}

//                 <motion.div className="flex flex-col items-center justify-center">
//                   <EmotionBadges
//                     emotions={currentEmotions}
//                     loading={areEmotionsLoading}
//                   />
//                 </motion.div>

//                 <motion.div
//                   variants={itemVariants}
//                   className="flex flex-col gap-4 px-4 mb-4"
//                 >
//                   {activitySuggestions.length > 0 && (
//                     <SuggestionContainer
//                       suggestions={activitySuggestions}
//                       onSuggestionHandled={handleSuggestionHandled}
//                       isConnected={isConnected}
//                     />
//                   )}

//                   {metricSuggestions.length > 0 && (
//                     <SuggestionContainer
//                       suggestions={metricSuggestions}
//                       onSuggestionHandled={handleSuggestionHandled}
//                       isConnected={isConnected}
//                     />
//                   )}

//                   {/* Only show the dynamic UI when AI type is plan-creation */}
//                   {assistantType === "plan-creation" ? (
//                     <PlanCreatorDynamicUI />
//                   ) : (
//                     <PlanBuildingContainer
//                       suggestions={planSuggestions}
//                       onPlanAccepted={handlePlanAccepted}
//                       onPlanRejected={handlePlanRejected}
//                       disabled={!isConnected}
//                     />
//                   )}
//                 </motion.div>

//                 <motion.div
//                   variants={itemVariants}
//                   className="flex-1 flex flex-col items-center justify-center gap-4 p-4 pb-[5.4rem]"
//                 >
//                   <AnimatePresence mode="wait">
//                     {!isConnected ? (
//                       <motion.div
//                         key="disconnected"
//                         variants={connectionStatusVariants}
//                         initial="initial"
//                         animate="animate"
//                         exit="exit"
//                       >
//                         <Button
//                           variant="ghost"
//                           onClick={handleReconnect}
//                           className="hover:bg-transparent"
//                         >
//                           {isConnecting ? (
//                             <>
//                               <Loader2
//                                 className="animate-spin text-gray-500 mr-2"
//                                 size={28}
//                               />
//                               <span className="text-xl font-normal italic">
//                                 Connecting...
//                               </span>
//                             </>
//                           ) : (
//                             <>
//                               <WifiOff
//                                 className="text-red-500 mr-2"
//                                 size={28}
//                               />
//                               <span className="text-xl font-normal underline">
//                                 Connect
//                               </span>
//                             </>
//                           )}
//                         </Button>
//                       </motion.div>
//                     ) : (
//                       <motion.div
//                         key="connected"
//                         variants={connectionStatusVariants}
//                         initial="initial"
//                         animate="animate"
//                         exit="exit"
//                         className="flex flex-row items-center justify-center w-full max-w-full"
//                       >
//                         {isVoiceMode ? (
//                           <VoiceModeInput
//                             isConnected={isConnected}
//                             isLoading={isLoading}
//                             isRecording={isRecording}
//                             toggleRecording={handleToggleRecording}
//                             cancelRecording={cancelRecording}
//                             onVoiceSent={handleVoiceSent}
//                             onModeToggle={handleVoiceModeToggle}
//                           />
//                         ) : (
//                           <ChatInput
//                             isConnected={isConnected}
//                             isLoading={isLoading}
//                             onTextSent={handleSendMessage}
//                             onVoiceSent={handleVoiceSent}
//                             onVoiceModeToggle={handleVoiceModeToggle}
//                           />
//                         )}
//                       </motion.div>
//                     )}
//                   </AnimatePresence>
//                   {isConnected && !isVoiceMode && (
//                     <div className="text-center -mt-1 mb-2">
//                       <span className="text-xs text-gray-400">
//                         ⚠️ Emotion analysis only available on voice input
//                       </span>
//                     </div>
//                   )}
//                 </motion.div>
//               </motion.div>
//             )}
//           </AnimatePresence>
//           <AlertDialog
//             open={showPendingChangesAlert}
//             onOpenChange={setShowPendingChangesAlert}
//           >
//             <AlertDialogContent>
//               <AlertDialogHeader>
//                 <AlertDialogTitle>Pending Changes</AlertDialogTitle>
//                 <AlertDialogDescription>
//                   Please accept or reject the pending suggestions before sending
//                   new messages.
//                 </AlertDialogDescription>
//               </AlertDialogHeader>
//               <AlertDialogFooter>
//                 <AlertDialogAction
//                   onClick={() => setShowPendingChangesAlert(false)}
//                 >
//                   Okay
//                 </AlertDialogAction>
//               </AlertDialogFooter>
//             </AlertDialogContent>
//           </AlertDialog>
//         </>
//       )}
//     </>
//   );
// };

// export default LogPage;


"use client";

import React from "react";

const AIPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">AI Coach</h1>
      <p className="text-gray-600">Coming soon...</p>
    </div>
  );
};

export default AIPage;
