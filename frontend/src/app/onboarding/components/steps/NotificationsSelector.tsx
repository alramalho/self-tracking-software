"use client";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Check } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { withFadeUpAnimation } from "../../lib";
import { useOnboarding } from "../OnboardingContext";

const NotificationsSelector = () => {
  const { completeStep } = useOnboarding();
  const { requestPermission, isPushGranted } = useNotifications();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isDevelopment = process.env.NODE_ENV === "development";

  const handleSuccessTransition = () => {
    setIsTransitioning(true);

    // Start the success animation
    setTimeout(() => {
      setIsSuccess(true);
    }, 100);

    // Complete the step after 2 seconds
    setTimeout(() => {
      completeStep("notifications-selection", {next: "partner-selection"});
    }, 2000);
  };

  async function handleRequestPermission() {
    console.log("requesting permission");
    const result = await requestPermission();
    console.log("result", result);
    if (result) {
      handleSuccessTransition();
    } else {
      toast.error(
        "Failed to set notifications permission. You might need to manually enable them in your phone settings.",
        {
          duration: 7000,
        }
      );
    }
  }

  useEffect(() => {
    if (isPushGranted) {
      handleSuccessTransition();
    } else {
      requestPermission();
    }
  }, []);

  return (
    <>
      {isDevelopment && (
        <button
          onClick={handleSuccessTransition}
          className="absolute bottom-4 left-4 w-8 h-8 opacity-0 cursor-pointer z-10"
          title="Development bypass"
        />
      )}
      <div className="w-full max-w-lg space-y-8 relative">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <motion.div
              animate={isTransitioning ? { scale: 1.1 } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                      delay: 0.1,
                    }}
                  >
                    <Check className="w-20 h-20 text-green-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="blocked"
                    initial={{ scale: 1 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Ban className="w-20 h-20 text-red-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.h2
              className="text-2xl mt-2 font-bold tracking-tight"
              animate={{
                color: isSuccess ? "#16a34a" : "#111827",
              }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.span
                    key="success-text"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    Thank you!
                  </motion.span>
                ) : (
                  <motion.span
                    key="blocked-text"
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    Notifications are required
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.h2>
          </div>

          <AnimatePresence>
            {!isSuccess && (
              <motion.div
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-md text-gray-600">
                  Notifications allow us to provide out-of-app outreach. As our
                  app relies on accountability and coaching, this is an
                  important part of the onboarding.
                </p>
                <p className="text-md text-gray-400 mt-2">
                  (You will be able to disable them after a while)
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSuccess && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-md text-green-600"
              >
                Notifications have been enabled successfully!
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!isSuccess && (
              <motion.div
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  size="lg"
                  className="rounded-2xl"
                  onClick={handleRequestPermission}
                  disabled={isTransitioning}
                >
                  Check Again
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default withFadeUpAnimation(NotificationsSelector);