"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import CreatePlanCardJourney from "@/components/CreatePlanCardJourney";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import ActivityEditor from "@/components/ActivityEditor";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";

export default function OnboardingPage() {
  const router = useRouter();
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showCreatePlanCardJourney, setShowCreatePlanCardJourney] =
    useState(false);

  const onCloseCompletionDialog = () => {
    setShowCompletionDialog(false);
    router.push("/add");
  };

  return (
    <>
      {showCompletionDialog ? (
        <Dialog
          open={showCompletionDialog}
          onOpenChange={onCloseCompletionDialog}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                <div className="flex flex-col items-center gap-4">
                  <span className="text-[60px] animate-bounce">🎉</span>
                  Awesome job!
                </div>
              </DialogTitle>
              <DialogDescription className="text-center pt-4">
                You&apos;ve successfully created your first activity!
                <br />
                Kick it off by logging last week&apos;s activities. That way you&apos;ll already see some pretty graphs 😁
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center pt-4">
              <Button onClick={onCloseCompletionDialog}>
                Continue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="fixed inset-0 bg-white z-[60]">
          <div className="h-full w-full overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-center p-4">
              {showCreatePlanCardJourney ? (
                <CreatePlanCardJourney
                  onComplete={() => {
                    toast.success("Plan creation finished successfully");
                    router.push("/");
                  }}
                ></CreatePlanCardJourney>
              ) : (
                <div className="text-center">
                  <div className="flex flex-row items-center justify-center gap-5">
                    <span className="text-[60px] animate-wiggle">👋</span>
                    <span className="text-3xl font-bold font-mono">Hey!</span>
                  </div>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                    Welcome to your{" "}
                    <span className="text-blue-500 break-normal text-nowrap">
                      tracking.so<span className="text-blue-300">ftware</span>
                    </span>
                  </h2>
                  <p className="mt-5 text-md text-gray-600">
                    Here you can track your plans and activities alongside your
                    friends.
                    <br />
                  </p>
                  <p className="mt-2 text-md text-gray-600">
                    Let&apos;s start your journey by
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowCreatePlanCardJourney(true)}
                  >
                    Creating your first plan
                  </Button>
                  <p className="mt-4 text-sm text-gray-600">
                    Or if you don&apos;t have an exact plan in mind, you can
                    just
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-2 border-2 border-gray-300"
                    onClick={() => router.push("/add?onboardingRedirect=true")}
                  >
                    Create your first activity
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
