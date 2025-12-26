import { usePlanCreation } from "@/contexts/plan-creation";
import { withFadeUpAnimation } from "@/contexts/plan-creation/lib";
import { Button } from "@/components/ui/button";
import { EmojiInput } from "@/components/ui/emoji-input";
import { Smile } from "lucide-react";

const EmojiStepWizard = () => {
  const { emoji, setEmoji, completeStep } = usePlanCreation();

  const handleContinue = () => {
    completeStep("emoji");
  };

  const canContinue = emoji && emoji.trim() !== "";

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Smile className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Choose an emoji
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Pick an emoji that represents your plan
        </p>
      </div>

      <div className="px-2 flex justify-center">
        <EmojiInput
          value={emoji || ""}
          onChange={setEmoji}
          placeholder="Pick an emoji"
        />
      </div>

      <div className="px-2">
        <Button onClick={handleContinue} className="w-full" disabled={!canContinue}>
          Continue
        </Button>
        {!canContinue && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Select an emoji to continue
          </p>
        )}
      </div>
    </div>
  );
};

export default withFadeUpAnimation(EmojiStepWizard);
