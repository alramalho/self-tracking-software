import React from "react";
import Number from "../Number";
import { EmojiInput } from "@/components/ui/EmojiInput";

interface EmojiStepProps {
  selectedEmoji: string;
  setSelectedEmoji: (emoji: string) => void;
}

const EmojiStep: React.FC<EmojiStepProps> = ({
  selectedEmoji,
  setSelectedEmoji,
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2 block flex items-center gap-2">
        <Number>3</Number>
        Choose a plan emoji
      </h3>
      <EmojiInput
        value={selectedEmoji}
        onChange={setSelectedEmoji}
        placeholder="Enter an emoji"
      />
    </div>
  );
};

export default EmojiStep; 