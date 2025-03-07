import { Check, ScanFace, X } from "lucide-react";
import AppleLikePopover from "./AppleLikePopover";
import { TextAreaWithVoice } from "./ui/TextAreaWithVoice";
import { useMutation } from "@tanstack/react-query";
import { useApiWithAuth } from "@/api";
import { Toaster, toast } from "sonner";
import { Checkbox } from "./ui/checkbox";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type QuestionsChecks = Record<string, string>;

// Base interface that all extraction response types should extend
export interface BaseExtractionResponse {
  question_checks?: Record<string, boolean>;
  message?: string;
}

export type DynamicUISuggesterProps<T extends BaseExtractionResponse> = {
  initialMessage: string;
  questionsChecks: QuestionsChecks;
  onSubmit: (text: string) => Promise<T>;
  shouldRenderChildren?: boolean;
  renderChildren?: (data: T) => React.ReactNode;
  onAccept?: (data: T) => Promise<void>;
  onReject?: (feedback: string, data: T) => Promise<void>;
  creationMessage?: string;
  placeholder?: string;
  title?: string;
};

export function DynamicUISuggester<T extends BaseExtractionResponse>({
  initialMessage,
  questionsChecks,
  onSubmit,
  renderChildren,
  shouldRenderChildren = true,
  onAccept,
  onReject,
  creationMessage = "Do you want me to process this for you?",
  placeholder = "You can also record a voice message if you prefer",
  title = "AI Suggester",
}: DynamicUISuggesterProps<T>) {
  const [text, setText] = useState("");
  const [rejectionFeedbackOpen, setRejectionFeedbackOpen] = useState(false);
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [extractedData, setExtractedData] = useState<T | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(questionsChecks).map((key) => [key, false]))
  );

  // Add refs for scrolling
  const checkboxesRef = useRef<HTMLDivElement>(null);
  const extractedDataRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Smooth scroll function
  const scrollToRef = (ref: React.RefObject<HTMLDivElement>) => {
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
      // Store the extracted data
      setExtractedData(data);
      
      // First checkbox animation - using optional chaining for safety
      if (data.question_checks) {
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
        toast(`💬 ${data.message}`);
      }

      // Then show extracted data after checkboxes
      const totalCheckboxDelay =
        (data.question_checks ? Object.keys(data.question_checks).length : 0) * 150 + 300;

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
          Object.keys(questionsChecks).map((key) => [key, false])
        )
      );
      setExtractedData(null);
    },
    onError: () => {
      console.error("Error submitting data");
      setIsLoading(false);
    },
  });

  const handleAccept = async () => {
    if (!extractedData || !onAccept) return;
    
    setIsSubmitting(true);
    try {
      await onAccept(extractedData);
      toast.success("Data processed successfully!");
    } catch (error) {
      toast.error("Failed to process data");
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

  const handleTextChange = (value: string) => {
    setText(value);
  };

  const renderedChildren = renderChildren && extractedData && renderChildren(extractedData);

  return (
    <>

        <div
          className="space-y-4 overflow-y-auto"
        >
          <Toaster position="top-center" closeButton duration={12000} />

          <h2
            className="text-sm text-gray-500 m-4 mt-6 text-center"
          >
            {title}
          </h2>

          <div>
            <ScanFace size={100} className="mx-auto" />
          </div>

          <p
            className="text-center text-lg font-semibold"
          >
            {initialMessage}
          </p>

          <div className="w-full px-4">
            <TextAreaWithVoice
              value={text}
              onChange={handleTextChange}
              placeholder={placeholder}
            />
          </div>

          <div className="px-4">
            <Button
              className="w-full"
              onClick={() => submitMutation.mutateAsync(text)}
              disabled={isLoading}
              loading={isLoading}
            >
              Submit
            </Button>
          </div>

          <div
            ref={checkboxesRef}
            className="space-y-3 mt-12 px-4"
          >
            <p className="text-sm text-gray-500">
              Be sure to mention:
            </p>
            {Object.keys(questionsChecks).map((key) => (
              <div
                key={key}
                className="flex items-center space-x-2"
              >
                <Checkbox checked={checkedItems[key] || false} disabled />
                <label className="text-sm text-gray-700">{key}</label>
              </div>
            ))}
          </div>

          {extractedData && (
            <div
              ref={extractedDataRef}
              className="opacity-100"
            >              
              {renderChildren && shouldRenderChildren && renderedChildren}
            </div>
          )}

          {extractedData && shouldRenderChildren && (onAccept || onReject) && (
            <div
              ref={actionsRef}
            >
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
                    className="w-full flex items-center gap-2 text-red-600"
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
                    className="w-full flex items-center gap-2 text-green-600"
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
        <div
          className="space-y-4"
        >
          <h2
            className="text-sm text-gray-500 m-4 mt-6 text-center"
          >
            Why not?
          </h2>

          <div
            className="px-4 w-full"
          >
            <TextAreaWithVoice
              value={rejectionFeedback}
              onChange={(value) => setRejectionFeedback(value)}
              placeholder="Tell us what we got wrong..."
            />
          </div>

          <div
            className="px-4"
          >
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