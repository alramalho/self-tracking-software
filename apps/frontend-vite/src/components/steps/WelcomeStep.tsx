/* eslint-disable react-refresh/only-export-components */

"use client";

import { useApiWithAuth } from "@/api";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useCurrentUser } from "@/contexts/users";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, User, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SubStep = "username" | "age";

const WelcomeStep = () => {
  const { completeStep } = useOnboarding();
  const api = useApiWithAuth();
  const { currentUser, updateUser } = useCurrentUser();
  const isUsernameSet = useMemo(() => !currentUser?.username?.startsWith("__pending__"), [currentUser?.username]);

  // Determine initial substep based on whether user has username
  const [currentSubStep, setCurrentSubStep] = useState<SubStep>(
    isUsernameSet ? "age" : "username"
  );

  // Username state
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmittingUsername, setIsSubmittingUsername] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Age state
  const [selectedAge, setSelectedAge] = useState(25);

  // Debounced username check
  useEffect(() => {
    if (currentSubStep !== "username") return;

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
  }, [username, api, currentSubStep]);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAvailable || !username) {
      toast.error(validationError || error || "Username is not available");
      return;
    }

    setIsSubmittingUsername(true);
    setError(null);

    try {
      await updateUser({
        updates: { username },
        muteNotifications: true,
      });
      toast.success("Username set successfully");
      // Fade to age selection
      setCurrentSubStep("age");
    } catch (err: any) {
      console.error("Failed to update username:", err);
      setError(
        err.response?.data?.error?.message ||
          "Failed to set username. Please try again."
      );
    } finally {
      setIsSubmittingUsername(false);
    }
  };

  const handleGetStarted = async () => {
    try {
      await updateUser({
        updates: { age: selectedAge },
        muteNotifications: true,
      });
      completeStep("welcome");
    } catch (error) {
      console.error("Error updating user age:", error);
      completeStep("welcome");
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

  const fadeVariants = {
    hidden: {
      opacity: 0,
      x: 20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: {
        duration: 0.3,
        ease: "easeIn",
      },
    },
  };

  return (
    <div className="w-full max-w-md space-y-5">
      {/* Header - always visible */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <img
            src="/icons/icon-transparent.png"
            alt="Tracking Software Logo"
            className="w-32 h-32 mx-auto"
          />
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome to your{" "}
            <span className="text-blue-500 break-normal text-nowrap">
              tracking.so<span className="text-blue-300">ftware</span>
            </span>
          </h2>
        </div>
        <p className="mt-2 text-md text-gray-600">
          The most effective app to improve your lifestyle.
        </p>
      </div>

      {/* Animated substep content */}
      <div className="relative min-h-[200px]">
        <AnimatePresence mode="wait">
          {currentSubStep === "username" && (
            <motion.div
              key="username"
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-6">
                  <User className="h-12 w-12 text-primary" />
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Choose your username
                </h3>
              </div>

              <form onSubmit={handleUsernameSubmit} className="space-y-4">
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
                      disabled={isSubmittingUsername}
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

                <div className="mx-auto w-fit">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-xl"
                    disabled={
                      !isAvailable || isSubmittingUsername || isChecking || !!validationError
                    }
                  >
                    {isSubmittingUsername ? "Setting username..." : "Continue"}
                    <ArrowRight size={20} className="ml-2" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {currentSubStep === "age" && (
            <motion.div
              key="age"
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              <div className="space-y-3">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    What&apos;s your age?
                  </h3>
                </div>

                <NumberInput
                  value={selectedAge}
                  onChange={setSelectedAge}
                  min={12}
                  max={100}
                  tenIncrements={true}
                  title="years old"
                />
              </div>

              <div className="mx-auto w-fit">
                <Button
                  size="lg"
                  className="w-full rounded-xl"
                  onClick={handleGetStarted}
                >
                  Start
                  <ArrowRight size={20} className="ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default withFadeUpAnimation(WelcomeStep);
