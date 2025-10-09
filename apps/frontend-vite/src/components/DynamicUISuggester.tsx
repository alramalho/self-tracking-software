import { useApiWithAuth } from "@/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ScanFace, X } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useRef, useState } from "react";
import { Remark } from "react-remark";
import AppleLikePopover from "./AppleLikePopover";
import { QuestionChecks, type QuestionsChecks } from "./QuestionChecks";
import { Button } from "./ui/button";
import { TextAreaWithVoice } from "./ui/text-area-with-voice";

const waveVariants = {
  initial: { rotate: 0 },
  wave: {
    rotate: [0, 25, -15, 25, -15, 0],
    transition: {
      delay: 1,
      duration: 1.5,
      times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      ease: "easeInOut",
    },
  },
};

// Base interface that all extraction response types should extend
export interface BaseExtractionResponse {
  question_checks?: Record<string, boolean>;
  message?: string;
}

export type DynamicUISuggesterProps<T extends BaseExtractionResponse> = {
  id: string;
  initialValue?: string;
  initialMessage?: string;
  questionPrefix?: string;
  questionsChecks?: QuestionsChecks;
  headerIcon?: React.ReactNode;
  submitButtonText?: string;
  emptySubmitButtonText?: string;
  onSubmit: (text: string) => Promise<T | void>;
  shouldRenderChildren?: boolean;
  renderIntermediateComponents?: () => React.ReactNode;
  renderChildren?: (data: T) => React.ReactNode;
  onAccept?: (data: T) => Promise<void>;
  onReject?: (feedback: string, data: T) => Promise<void>;
  creationMessage?: string;
  placeholder?: string;
  canSubmit?: () => boolean;
  title?: string;
  description?: string;
  wave?: boolean;
  disableEmptySubmit?: boolean;
  onSkip?: () => void;
};

export function DynamicUISuggester<T extends BaseExtractionResponse>({
  id,
  initialValue,
  initialMessage,
  questionPrefix,
  questionsChecks,
  submitButtonText = "Send",
  emptySubmitButtonText,
  onSubmit,
  renderChildren,
  headerIcon,
  renderIntermediateComponents,
  shouldRenderChildren = true,
  onAccept,
  onReject,
  creationMessage = "Do you want me to process this for you?",
  placeholder = "You can also record a voice message for extended detail",
  title,
  description,
  wave = false,
  disableEmptySubmit = false,
  onSkip,
  canSubmit,
}: DynamicUISuggesterProps<T>) {
  const [text, setText] = useState(initialValue || "");
  const [rejectionFeedbackOpen, setRejectionFeedbackOpen] = useState(false);
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [extractedData, setExtractedData] = useState<T | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [alreadyLoggedAttemptError, setAlreadyLoggedAttemptError] =
    useState(false);
  const api = useApiWithAuth();
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState("");

  const posthog = usePostHog();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    Object.fromEntries(
      Object.keys(questionsChecks ?? {}).map((q) => [q, false])
    )
  );

  const allQuestionsChecked = Object.values(checkedItems).every(
    (check) => check
  );

  // Add refs for scrolling
  const checkboxesRef = useRef<HTMLDivElement>(null);
  const extractedDataRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Smooth scroll function
  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (text: string) => {
      return await onSubmit(text);
    },
    onSuccess: (data) => {
      if (!data) {
        data = { question_checks: {}, message: "" } as T;
      }
      // Store the extracted data
      setExtractedData(data);
      const thisAttempt = attempts + 1;
      setAttempts(thisAttempt);

      // First checkbox animation - using optional chaining for safety
      if (data.question_checks) {
        const allChecksTrue = Object.values(data.question_checks).every(
          (check) => check
        );
        posthog?.capture(`dynamic-ui-${id}-attempt-${thisAttempt}`, {
          value: thisAttempt,
          all_checks_true: allChecksTrue,
        });

        if (thisAttempt >= 3) {
          api.post("/ai/log-dynamic-ui-attempt-error", {
            id: id,
            extracted_data: data,
            question_checks: data.question_checks,
            attempts: thisAttempt,
          });
          setAlreadyLoggedAttemptError(true);
        }

        Object.keys(data.question_checks).forEach((key, index) => {
          setTimeout(() => {
            setCheckedItems((prev) => ({
              ...prev,
              [key]: data.question_checks?.[key] || false,
            }));
            // Scroll to checkboxes after first item is checked
            if (index === 0) {
              scrollToRef(checkboxesRef);
            }
          }, index * 150);
        });
      }

      if (data.message) {
        setMessage(data.message);
        setShowMessage(true);
      }

      // Then show extracted data after checkboxes
      const totalCheckboxDelay =
        (data.question_checks ? Object.keys(data.question_checks).length : 0) *
          150 +
        300;

      setTimeout(() => {
        setIsLoading(false);

        // Scroll to extracted data after it appears
        setTimeout(() => {
          scrollToRef(extractedDataRef);
        }, 100);

        // Scroll to actions after another delay
        setTimeout(() => {
          scrollToRef(actionsRef);
        }, 600);
      }, totalCheckboxDelay);
    },
    onMutate: () => {
      setIsLoading(true);
      // Reset state
      setCheckedItems(
        Object.fromEntries(
          Object.keys(questionsChecks ?? {}).map((key) => [key, false])
        )
      );
      setExtractedData(null);
    },
    onError: (error) => {
      console.error("Error submitting data:", error);
      setIsLoading(false);
    },
  });

  const handleAccept = async () => {
    if (!extractedData || !onAccept) return;

    setIsSubmitting(true);
    try {
      await onAccept(extractedData);
      setMessage("Data processed successfully!");
      setShowMessage(true);
    } catch (error) {
      setMessage("Failed to process data");
      setShowMessage(true);
      console.error("Error processing data:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejection = async () => {
    if (!extractedData || !onReject) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onReject(rejectionFeedback, extractedData);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setIsSubmitting(false);
      setRejectionFeedbackOpen(false);
    }
  };

  const handleSkip = () => {
    api.post("/ai/log-dynamic-ui-skip", {
      id: id,
      extracted_data: extractedData,
      question_checks: questionsChecks,
      attempts: attempts,
    });
    onSkip?.();
  };

  const handleTextChange = (value: string) => {
    setText(value);
  };

  const renderedChildren =
    renderChildren && extractedData && renderChildren(extractedData);

  return (
    <>
      <div className="space-y-4 overflow-y-auto overflow-x-visible">
        <div className="flex justify-center items-center gap-4 overflow-visible">
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative"
          >
            {headerIcon && !message ? (
              <div className="flex items-center justify-center w-[100px] h-[100px]">
                {headerIcon}
              </div>
            ) : (
              <ScanFace size={100} className={`${variants.text}`} />
            )}
            {wave && (
              <motion.span
                className="absolute bottom-[9px] left-[-40px] text-5xl"
                initial="initial"
                animate="wave"
                variants={waveVariants}
                style={{ transformOrigin: "90% 90%" }}
              >
                👋
              </motion.span>
            )}
          </motion.div>
          <AnimatePresence>
            {showMessage && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, x: -10 }}
                transition={{ duration: 0.3, layout: true }}
                className="bg-white p-3 rounded-lg shadow-md max-w-[250px] text-sm border border-gray-200 flex-shrink relative"
              >
                <Remark>{message}</Remark>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          {title && (
            <>
              <h2 className="text-2xl font-semibold text-center">{title}</h2>
            </>
          )}

          <p className="text-center text-md text-gray-600 mt-2">
            {initialMessage}
          </p>
        </div>
        {renderIntermediateComponents && (
          <div className="px-4">{renderIntermediateComponents()}</div>
        )}

        {description && (
          <div className="px-4">
            <p
              className={`text-sm text-gray-500 ${
                questionsChecks ? "text-left" : "text-center"
              }`}
            >
              {description}
            </p>
          </div>
        )}

        {questionsChecks && (
          <QuestionChecks
            ref={checkboxesRef}
            questionsChecks={questionsChecks}
            checkedItems={checkedItems}
            questionPrefix={questionPrefix}
            // onItemClick={() => {
            //   setMessage(
            //     "These checkboxes are not to be checked manually! They get auto-filled as you type or dictate your answer below"
            //   );
            //   setShowMessage(true);
            // }}
          />
        )}

        <div className="w-full px-4">
          <TextAreaWithVoice
            value={text}
            onChange={handleTextChange}
            placeholder={placeholder}
            onRecordingStarted={() => {
              console.log("recording started");
              setIsRecording(true);
            }}
            onRecordingStopped={() => {
              console.log("recording stopped");
              setIsRecording(false);
            }}
            onVoiceTranscripted={async (transcript) => {
              setText(transcript);
              await submitMutation.mutateAsync(transcript);
            }}
          />
        </div>

        <div className="px-4">
          <Button
            variant={allQuestionsChecked ? "outline" : "default"}
            className={`w-full rounded-xl ${
              allQuestionsChecked ? "bg-white" : ""
            }`}
            onClick={() => submitMutation.mutateAsync(text)}
            disabled={
              (disableEmptySubmit && text.length === 0) ||
              (canSubmit && !canSubmit() && !text) ||
              isRecording ||
              isLoading ||
              isSubmitting
            }
            loading={isLoading}
          >
            {text.length > 0
              ? submitButtonText
              : emptySubmitButtonText ?? submitButtonText ?? "Send"}
            {allQuestionsChecked ? " again" : ""}
          </Button>
        </div>

        {alreadyLoggedAttemptError && onSkip && (
          <div className="px-4">
            <Button
              variant="outline"
              className="w-full bg-white italic"
              onClick={handleSkip}
            >
              Seems like you&apos;re struggling. Skip for now
            </Button>
          </div>
        )}

        {extractedData && (
          <div ref={extractedDataRef} className="opacity-100 px-4">
            {renderChildren && shouldRenderChildren && renderedChildren}
          </div>
        )}

        {extractedData && shouldRenderChildren && (onAccept || onReject) && (
          <div ref={actionsRef}>
            <div className="text-sm text-gray-500 mt-8 text-left w-full px-4 mt-4">
              <p className="flex flex-row gap-2">
                <ScanFace size={24} />
                {creationMessage ?? "Do you want me to process this for you?"}
              </p>
            </div>
            <div className="flex flex-row gap-2 justify-center mt-4">
              {onReject && (
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2 text-red-600 bg-white border-red-600"
                  onClick={() => setRejectionFeedbackOpen(true)}
                  disabled={isSubmitting}
                >
                  <X className="w-6 h-6" />
                  Reject
                </Button>
              )}
              {onAccept && (
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2 text-green-600 bg-white border-green-600"
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  <Check className="w-6 h-6" />
                  Accept
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <AppleLikePopover
        open={rejectionFeedbackOpen}
        onClose={() => setRejectionFeedbackOpen(false)}
      >
        <div className="space-y-4">
          <h2 className="text-md text-gray-800 m-4 mt-6 text-center font-semibold">
            Please tell us what we got wrong
          </h2>
          <p className="text-sm text-gray-500 px-4 py-2 text-center">
            The AI has a smart memory and can learn from your feedback. You can
            ask the AI to correct the mistake.
          </p>

          <div className="px-4 w-full">
            <TextAreaWithVoice
              disabled={isSubmitting}
              value={rejectionFeedback}
              onChange={(value: any) => setRejectionFeedback(value)}
              placeholder="The AI got the activity dates wrong"
            />
          </div>

          <div className="px-4">
            <Button
              className="w-full"
              onClick={handleRejection}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      </AppleLikePopover>
    </>
  );
}
