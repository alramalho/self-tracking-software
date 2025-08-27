import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EmojiStepProps {
  selectedEmoji: string;
  setSelectedEmoji: (emoji: string) => void;
  onNext: () => void;
}

const EmojiStep: React.FC<EmojiStepProps> = ({
  selectedEmoji,
  setSelectedEmoji,
  onNext,
}) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Choose an emoji for your plan (Optional)</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          id="emoji"
          type="text"
          value={selectedEmoji}
          onChange={(e) => setSelectedEmoji(e.target.value)}
          placeholder="Enter an emoji"
          className="mb-4 text-[16px]"
          maxLength={5}
        />
        <Button className="w-full" onClick={onNext}>
          Next
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmojiStep; 