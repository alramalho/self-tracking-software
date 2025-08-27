import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";

interface FinishingDateStepProps {
  finishingDate: Date | undefined;
  setFinishingDate: (date: Date | undefined) => void;
  onNext: () => void;
}

const FinishingDateStep: React.FC<FinishingDateStepProps> = ({
  finishingDate,
  setFinishingDate,
  onNext,
}) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Do you have a finishing date? (Optional)</CardTitle>
      </CardHeader>
      <CardContent>
        <DatePicker
          selected={finishingDate}
          onSelect={(date: Date | undefined) => setFinishingDate(date)}
          disablePastDates={true}
        />
        <Button className="w-full mt-4" onClick={onNext}>
          Next
        </Button>
      </CardContent>
    </Card>
  );
};

export default FinishingDateStep; 