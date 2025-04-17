import { useCallback } from "react";
import { useApiWithAuth } from "@/api";
import { useState } from "react";
import { Button } from "./ui/button";
import { DynamicUISuggester } from "./DynamicUISuggester";

export function ProfileSetupDynamicUI({
  onSubmit,
  submitButtonText = "Next",
}: {
  onSubmit: () => void;
  submitButtonText?: string;
}) {
  const questionsChecks = {
    "Who you are (your age, occupation, etc.)":
      "What does the user do or likes to do.",
    "What do you want to achieve (your vision)":
      "Does the user share any thoughts about their aspirations?",
  };
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const api = useApiWithAuth();

  const renderChildrenContent = useCallback(
    (data: { question_checks: Record<string, boolean>; message: string }) => (
      <div>
        <Button
          disabled={!allQuestionsAnswered}
          className="w-full"
          onClick={() => {
            onSubmit();
          }}
        >
          {submitButtonText}
        </Button>
      </div>
    ),
    [allQuestionsAnswered]
  );

  return (
    <div>
      <DynamicUISuggester<{
        question_checks: Record<string, boolean>;
        message: string;
      }>
        id="profile-setup"
        questionPrefix="I'd like to know"
        initialMessage="Tell me a bit about yourself."
        placeholder="Voice messages are better suited for this step"
        questionsChecks={questionsChecks}
        onSubmit={async (text) => {
          const response = await api.post(
            "/ai/update-user-profile-from-questions",
            {
              message: text,
              question_checks: questionsChecks,
            }
          );

          setAllQuestionsAnswered(
            Object.values(response.data.question_checks).every((value) => value)
          );

          return response.data;
        }}
        renderChildren={renderChildrenContent}
      />
    </div>
  );
}
