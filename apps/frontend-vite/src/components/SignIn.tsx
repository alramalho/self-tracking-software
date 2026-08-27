import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth";
import { Capacitor } from "@capacitor/core";
import { SignIn as ClerkSignIn } from "@clerk/clerk-react";
import { useState } from "react";

interface SignInProps {
  forceRedirectUrl?: string;
  onSuccess?: () => void;
}

export const SignIn: React.FC<SignInProps> = ({
  forceRedirectUrl = "/",
  onSuccess,
}) => {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const runNativeSignIn = async (provider: "google" | "apple") => {
    setIsLoading(true);
    setError(null);
    try {
      await (provider === "google" ? signInWithGoogle() : signInWithApple());
      onSuccess?.();
    } catch (signInError) {
      console.error(`${provider} sign in failed`, signInError);
      setError("Failed to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {isNative && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => runNativeSignIn("google")}
              disabled={isLoading}
              className="w-full"
              variant="outline"
              size="lg"
            >
              Continue with Google
            </Button>
            {Capacitor.getPlatform() === "ios" && (
              <Button
                onClick={() => runNativeSignIn("apple")}
                disabled={isLoading}
                className="w-full"
                variant="outline"
                size="lg"
              >
                Continue with Apple
              </Button>
            )}
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </CardContent>
        </Card>
      )}

      <ClerkSignIn
        routing="hash"
        fallbackRedirectUrl={forceRedirectUrl}
        appearance={
          isNative
            ? {
                elements: {
                  socialButtonsBlockButton: "hidden",
                  dividerRow: "hidden",
                },
              }
            : undefined
        }
      />
    </div>
  );
};
