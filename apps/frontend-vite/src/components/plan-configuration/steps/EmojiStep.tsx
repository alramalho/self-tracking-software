import { EmojiInput } from "@/components/ui/emoji-input";
import React from "react";
import Number from "../Number";

interface EmojiStepProps {
  selectedEmoji: string;
  setSelectedEmoji: (emoji: string) => void;
  number: number;
}

const EmojiStep: React.FC<EmojiStepProps> = ({
  selectedEmoji,
  setSelectedEmoji,
  number,
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2 block flex items-center gap-2">
        <Number>{number}</Number>
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