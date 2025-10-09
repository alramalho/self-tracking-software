import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/username-selection")({
  component: RouteComponent,
});

function RouteComponent() {
  const api = useApiWithAuth();
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Debounced username check
  useEffect(() => {
    if (!username || username.length < 3) {
      setIsAvailable(null);
      setValidationError(
        username.length > 0 && username.length < 3
          ? "Username must be at least 3 characters"
          : null
      );
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setIsAvailable(false);
      setValidationError(
        "Username can only contain lowercase letters, numbers, and underscores"
      );
      return;
    }

    setValidationError(null);
    setError(null);
    setIsChecking(true);

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get(`/users/check-username/${username}`);
        setIsAvailable(!response.data.exists);
        if (response.data.exists) {
          setError("Username is already taken");
        }
      } catch (err) {
        console.error("Failed to check username:", err);
        setError("Failed to check username availability");
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, api]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAvailable || !username) {
      toast.error(validationError || error || "Username is not available");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post("/users/update-user", { username });
      navigate({ to: "/onboarding" });
      toast.success("Username set successfully");
    } catch (err: any) {
      console.error("Failed to update username:", err);
      setError(
        err.response?.data?.error?.message ||
          "Failed to set username. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getValidationIcon = () => {
    if (!username || username.length < 3) return null;
    if (validationError)
      return <XCircle className="h-6 w-6 text-destructive" />;
    if (isChecking)
      return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
    if (isAvailable) return <CheckCircle2 className="h-6 w-6 text-green-600" />;
    return <XCircle className="h-6 w-6 text-destructive" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-6">
            <User className="h-12 w-12 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Choose your username
          </h1>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="relative">
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="pr-10 text-lg bg-white border-xl py-2 px-4"
                autoFocus
                disabled={isSubmitting}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getValidationIcon()}
              </div>
            </div>
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            {!validationError && error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {!validationError &&
              !error &&
              isAvailable &&
              username.length >= 3 && (
                <p className="text-sm text-green-600">Username is available!</p>
              )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              !isAvailable || isSubmitting || isChecking || !!validationError
            }
          >
            {isSubmitting ? "Setting username..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
