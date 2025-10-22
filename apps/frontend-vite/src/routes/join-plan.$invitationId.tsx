import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanGroupInvitation, usePlans } from "@/contexts/plans";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, Link2, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Activity } from "@tsw/prisma";

export const Route = createFileRoute("/join-plan/$invitationId")({
  component: JoinPlanPage,
});

function JoinPlanPage() {
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const {
    planInvitation,
    isLoadingPlanInvitation,
    acceptPlanInvitation,
    isAcceptingPlanInvitation,
    rejectPlanInvitation,
    isRejectingPlanInvitation,
  } = usePlanGroupInvitation(invitationId);
  const { plans } = usePlans();
  const [showAcceptOptions, setShowAcceptOptions] = useState(false);

  const invitation = planInvitation.data;
  const plan = invitation?.planGroup?.plans?.[0];
  const inviter = invitation?.invitedBy;

  const handleReject = async () => {
    try {
      await rejectPlanInvitation(invitationId);
      navigate({ to: "/" });
    } catch (error) {
      console.error("Failed to reject invitation:", error);
    }
  };

  const handleAcceptWithNewPlan = async () => {
    try {
      await acceptPlanInvitation({ planInvitationId: invitationId });
      navigate({ to: "/plans" });
    } catch (error) {
      console.error("Failed to accept invitation:", error);
    }
  };

  const handleAcceptWithExistingPlan = async (existingPlanId: string) => {
    try {
      await acceptPlanInvitation({
        planInvitationId: invitationId,
        existingPlanId: existingPlanId
      });
      navigate({ to: "/plans" });
    } catch (error) {
      console.error("Failed to accept invitation:", error);
    }
  };

  if (isLoadingPlanInvitation) {
    return (
      <div className="flex flex-col items-center min-h-screen p-4 bg-gradient-to-b from-muted to-background">
        <div className="w-full max-w-md">
          <div className="flex items-center mb-6">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-40 ml-4" />
          </div>
          <Skeleton className="h-48 w-full rounded-2xl mb-4" />
          <Skeleton className="h-32 w-full rounded-2xl mb-4" />
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!invitation || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Invitation not found</h2>
          <p className="text-muted-foreground mb-4">
            This invitation may have expired or been removed.
          </p>
          <Button onClick={() => navigate({ to: "/" })}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-4 bg-gradient-to-b from-muted to-background">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            className="p-2 rounded-full hover:bg-muted/50"
            onClick={() => window.history.back()}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold ml-2">Plan Invitation</h1>
        </div>

        {/* Inviter Info */}
        {inviter && (
          <div className="bg-card rounded-2xl p-4 mb-4 shadow-sm border border-border">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={inviter.picture || ""} alt={inviter.name || ""} />
                <AvatarFallback>{(inviter.name || "U")[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Invited by</p>
                <p className="font-semibold">{inviter.name}</p>
                <p className="text-sm text-muted-foreground">@{inviter.username}</p>
              </div>
            </div>
          </div>
        )}

        {/* Plan Overview */}
        <div className="bg-card rounded-2xl p-6 mb-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-5xl">{plan.emoji}</span>
            <div>
              <h2 className="text-xl font-bold">{plan.goal}</h2>
              {plan.outlineType === "TIMES_PER_WEEK" && (
                <p className="text-muted-foreground">
                  {plan.timesPerWeek} times per week
                </p>
              )}
              {plan.outlineType === "SPECIFIC" && (
                <p className="text-muted-foreground">Custom plan</p>
              )}
            </div>
          </div>

          {/* Activities */}
          {plan.activities && plan.activities.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Activities</h3>
              <div className="space-y-2">
                {plan.activities.map((activity: Activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                  >
                    <span className="text-2xl">{activity.emoji}</span>
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.measure}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.notes && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-foreground">{plan.notes}</p>
            </div>
          )}
        </div>

        {/* Accept/Reject Options */}
        {!showAcceptOptions ? (
          <div className="flex gap-3">
            <Button
              onClick={handleReject}
              variant="outline"
              className="flex-1 rounded-full"
              disabled={isRejectingPlanInvitation}
            >
              <X className="mr-2" size={18} />
              Decline
            </Button>
            <Button
              onClick={() => setShowAcceptOptions(true)}
              className="flex-1 rounded-full bg-black text-white hover:bg-foreground/90"
            >
              <Check className="mr-2" size={18} />
              Accept
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center font-semibold mb-3">
              How would you like to track this plan?
            </p>

            <Button
              onClick={handleAcceptWithNewPlan}
              className="w-full rounded-xl h-auto p-4 bg-black text-white hover:bg-foreground/90"
              disabled={isAcceptingPlanInvitation}
            >
              <div className="flex items-center justify-center gap-3 w-full">
                <Plus size={20} className="flex-shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="font-semibold">Copy their Plan</p>
                  <span className="text-sm opacity-80 break-words text-wrap">
                    Start fresh by mimicking their plan and activities
                  </span>
                </div>
              </div>
            </Button>

            {/* Assign to Existing Plan */}
            {plans && plans.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Or link to an existing plan:
                </p>
                {plans.map((existingPlan) => (
                  <Button
                    key={existingPlan.id}
                    onClick={() => handleAcceptWithExistingPlan(existingPlan.id)}
                    variant="outline"
                    className="w-full rounded-xl h-auto py-3"
                    disabled={isAcceptingPlanInvitation}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Link2 size={18} />
                      <span className="text-xl">{existingPlan.emoji}</span>
                      <div className="text-left flex-1">
                        <p className="font-medium">{existingPlan.goal}</p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}

            <Button
              onClick={() => setShowAcceptOptions(false)}
              variant="ghost"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
