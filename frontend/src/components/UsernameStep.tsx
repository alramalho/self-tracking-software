import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";

interface UsernameStepProps {
  username: string;
  setUsername: (username: string) => void;
  isUsernameAvailable: boolean;
  isCheckingUsername: boolean;
  onNext: () => void;
  api: any;
  userDataQuery: any;
}

const UsernameStep: React.FC<UsernameStepProps> = ({
  username,
  setUsername,
  isUsernameAvailable,
  isCheckingUsername,
  onNext,
  api,
  userDataQuery,
}) => {
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value.toLowerCase();
    setUsername(newUsername);
    // Assume checkUsername is a function passed as a prop or defined here
    checkUsername(newUsername);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Choose a username</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          type="text"
          value={username}
          onChange={handleUsernameChange}
          placeholder="Enter a username"
          className="mb-4"
        />
        {username.trim() !== "" && (
          <div className="flex items-center text-sm mb-4">
            {isCheckingUsername ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <p>Checking username availability...</p>
              </>
            ) : isUsernameAvailable ? (
              <>
                <Check className="mr-2 h-4 w-4 text-lime-500" />
                <p className="text-green-500">Username is available</p>
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4 text-red-500" />
                <p className="text-red-500">Username is already taken</p>
              </>
            )}
          </div>
        )}
        <Button
          className="w-full"
          onClick={() => {
            if (username.trim()) {
              api.post("/update-user", { username });
              userDataQuery.refetch();
            }
            onNext();
          }}
          disabled={username.trim() === "" || !isUsernameAvailable}
        >
          Next
        </Button>
      </CardContent>
    </Card>
  );
};

export default UsernameStep; 