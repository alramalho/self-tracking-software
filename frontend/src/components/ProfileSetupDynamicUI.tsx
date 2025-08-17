import { useCallback } from "react";
import { useApiWithAuth } from "@/api";
import { useState } from "react";
import { Button } from "./ui/button";
import { DynamicUISuggester } from "./DynamicUISuggester";
import { UserRoundPen } from "lucide-react";

export function ProfileSetupDynamicUI({
  onSubmit,
  submitButtonText = "Next",
}: {
  onSubmit: () => void;
  submitButtonText?: string;
}) {
  const questionsChecks = {
    "A description of the user. This will be used for helping other users find you." : {
      title: "Your details",
      description: "Like your age, occupation, or anything that you find relevant.",
    },
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
        headerIcon={<UserRoundPen className="w-20 h-20 text-blue-600" />}
        title="Set up your profile description"
        placeholder="For example, I'm a 25-year-old male software engineer who loves to code and build things."
        questionPrefix="You should include"
        questionsChecks={questionsChecks}
        canSubmit={() => allQuestionsAnswered}
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
        // renderChildren={renderChildrenContent}
      />
    </div>
  );
}
