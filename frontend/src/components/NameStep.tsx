import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NameStepProps {
  name: string;
  setName: (name: string) => void;
  onNext: () => void;
  isNewPlan: boolean;
  api: any;
  userDataQuery: any;
}

const NameStep: React.FC<NameStepProps> = ({
  name,
  setName,
  onNext,
  isNewPlan,
  api,
  userDataQuery,
}) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>What is your name?</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="mb-4"
        />
        <Button
          className="w-full"
          onClick={() => {
            if (!isNewPlan) {
              api.post("/update-user", { name });
              userDataQuery.refetch();
            }
            onNext();
          }}
          disabled={!name.trim()}
        >
          Next
        </Button>
      </CardContent>
    </Card>
  );
};

export default NameStep; 