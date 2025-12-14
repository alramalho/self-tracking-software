import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePlans } from "@/contexts/plans";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isAfter } from "date-fns";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  LandPlot,
  Loader2,
  Route as RouteIcon,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/get-coached")({
  component: GetCoachedPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      coach: (search.coach as string) || undefined,
    };
  },
});

interface CoachDetails {
  title: string;
  bio: string;
  focusDescription: string;
  idealPlans: Array<{ emoji: string; title: string }>;
  introVideoUrl?: string;
}

interface HumanCoach {
  id: string;
  ownerId: string;
  type: "HUMAN";
  details: CoachDetails;
  owner: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
}

const CoachingFeatureItem = ({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted">
      {icon}
    </div>
    <p className="text-sm text-muted-foreground">{title}</p>
  </div>
);

function GetCoachedPage() {
  const navigate = useNavigate();
  const api = useApiWithAuth();
  const { plans, isLoadingPlans } = usePlans();
  const { coach: coachUsername } = Route.useSearch();

  const [selectedCoach, setSelectedCoach] = useState<HumanCoach | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePlans = useMemo(
    () =>
      plans?.filter(
        (plan) =>
          plan.deletedAt === null &&
          !plan.isCoached &&
          (plan.finishingDate === null ||
            isAfter(plan.finishingDate, new Date()))
      ) || [],
    [plans]
  );

  const { data: humanCoaches, isLoading: isLoadingCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const response = await api.get<HumanCoach[]>("/coaches");
      return response.data;
    },
  });

  // Pre-select coach from query param
  useEffect(() => {
    if (coachUsername && humanCoaches && !selectedCoach) {
      const coach = humanCoaches.find(
        (c) => c.owner.username === coachUsername
      );
      if (coach) {
        setSelectedCoach(coach);
      }
    }
  }, [coachUsername, humanCoaches, selectedCoach]);

  const coachIcon = "/images/jarvis_logo_blue_transparent.png";

  const handleSelectAICoach = () => {
    // For AI coach, just navigate to onboarding or home
    navigate({ to: "/" });
    toast.success("You're already using Oli as your AI coach!");
  };

  const handleSelectHumanCoach = (coach: HumanCoach) => {
    setSelectedCoach(coach);
  };

  const handleBack = () => {
    if (selectedCoach) {
      setSelectedCoach(null);
      setSelectedPlanId(null);
      setMessage("");
    } else {
      navigate({ to: "/" });
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedCoach || !selectedPlanId) {
      toast.error("Please select a plan");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/coaches/request", {
        coachId: selectedCoach.id,
        planId: selectedPlanId,
        message: message.trim() || undefined,
      });
      toast.success("Coaching request sent! We will notify you when the coach accepts your request.");
      navigate({ to: "/" });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to send request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show plan & message selection if a human coach is selected
  if (selectedCoach) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-muted"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Request Coaching</h1>
              <p className="text-sm text-muted-foreground">
                from {selectedCoach.owner.name || selectedCoach.owner.username}
              </p>
            </div>
          </div>

          {/* Selected Coach Card (mini) */}
          <div className="rounded-2xl overflow-hidden relative mb-6">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${selectedCoach.owner.picture || ""})`,
              }}
            />
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/20">
                  {selectedCoach.owner.picture && (
                    <img
                      src={selectedCoach.owner.picture}
                      alt={selectedCoach.owner.name || ""}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {selectedCoach.owner.name || selectedCoach.owner.username}
                  </h3>
                  <p className="text-sm text-white/70">
                    {selectedCoach.details.title}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Selection */}
          <div className="space-y-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Select a plan</h2>
              <p className="text-sm text-muted-foreground">
                Which plan do you want coaching for?
              </p>
            </div>

            {isLoadingPlans ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : activePlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>You don't have any active plans yet.</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate({ to: "/plans" })}
                >
                  Create a Plan
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {activePlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative flex flex-col items-center justify-center rounded-xl bg-muted p-4 transition-all duration-200 ${
                      selectedPlanId === plan.id
                        ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
                        : "hover:bg-muted/80"
                    }`}
                  >
                    {selectedPlanId === plan.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-5 w-5 text-blue-500" />
                      </div>
                    )}
                    <span className="text-2xl mb-2">{plan.emoji}</span>
                    <span className="text-sm font-medium text-center text-foreground line-clamp-2">
                      {plan.goal}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message Input */}
          {activePlans.length > 0 && (
            <div className="space-y-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  Tell them about yourself
                </h2>
                <p className="text-sm text-muted-foreground">
                  Why do you want coaching? What are your goals?
                </p>
              </div>

              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="I've been struggling to stay consistent with my plan because..."
                className="min-h-[120px] resize-none"
              />
            </div>
          )}

          {/* Submit Button */}
          {activePlans.length > 0 && (
            <Button
              onClick={handleSubmitRequest}
              disabled={!selectedPlanId || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Coaching Request
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            The coach will review your request and respond within a few days.
          </p>
        </div>
      </div>
    );
  }

  // Coach selection view
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full hover:bg-muted"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Get Coached</h1>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-16 h-16 text-blue-600" />
              <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
                Choose your coach
              </h2>
            </div>
            <p className="text-md text-muted-foreground">
              All coaches help you build habits with the same powerful features.
            </p>
          </div>

          {/* Shared coaching features */}
          <div className="space-y-3 px-2">
            <CoachingFeatureItem
              icon={<LandPlot className="w-5 h-5 text-blue-500" />}
              title="Track your plan progress"
            />
            <CoachingFeatureItem
              icon={<Send className="w-5 h-5 text-blue-500" />}
              title="Check-ins several times a week"
            />
            <CoachingFeatureItem
              icon={<RouteIcon className="w-5 h-5 text-blue-500" />}
              title="Weekly plan adjustments based on progress"
            />
          </div>

          <div className="space-y-3">
            {/* AI Coach Option */}
            <button
              onClick={handleSelectAICoach}
              className="w-full text-left rounded-2xl overflow-hidden relative group cursor-pointer"
            >
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-700" />
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
              <div className="absolute inset-0 group-hover:bg-white/10 transition-colors" />

              {/* Content */}
              <div className="relative p-4 text-white">
                {/* Name with icon */}
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={coachIcon}
                    alt="AI Coach"
                    className="w-8 h-8 brightness-0 invert"
                  />
                  <h3 className="text-lg font-bold">Oli</h3>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">
                      Type
                    </p>
                    <p className="text-sm font-semibold">AI Coach</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">
                      Availability
                    </p>
                    <p className="text-sm font-semibold">24/7</p>
                  </div>
                </div>

                <p className="text-xs text-white/70 mt-3">
                  Research-backed guidance with adaptive scheduling
                </p>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                or
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Human Coaches */}
            {isLoadingCoaches ? (
              <>
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                ))}
              </>
            ) : (
              humanCoaches?.map((coach) => {
                const details = coach.details;

                return (
                  <button
                    key={coach.id}
                    onClick={() => handleSelectHumanCoach(coach)}
                    className="w-full text-left rounded-2xl overflow-hidden relative group cursor-pointer"
                  >
                    {/* Background with profile image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${coach.owner.picture || ""})`,
                      }}
                    />
                    {/* Dark overlay */}
                    <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition-colors" />

                    {/* Content */}
                    <div className="relative p-4 text-white">
                      {/* Name */}
                      <h3 className="text-lg font-bold mb-2">
                        {coach.owner.name || coach.owner.username}
                      </h3>

                      {/* Specs Grid */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/60">
                            Title
                          </p>
                          <p className="text-sm font-semibold">
                            {details.title}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/60">
                            Focus
                          </p>
                          <p className="text-sm font-semibold">
                            {details.focusDescription}
                          </p>
                        </div>
                        {details.idealPlans && details.idealPlans.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase tracking-wider text-white/60">
                              Helps with
                            </p>
                            <p className="text-sm font-semibold">
                              {details.idealPlans
                                .slice(0, 3)
                                .map((p) => `${p.emoji} ${p.title}`)
                                .join(" · ")}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Bio preview */}
                      {details.bio && (
                        <p className="text-xs text-white/70 mt-3 line-clamp-2">
                          {details.bio}
                        </p>
                      )}

                      <p className="text-[10px] text-white/50 mt-3 italic">
                        Subject to acceptance by coach
                      </p>
                    </div>
                  </button>
                );
              })
            )}

            {!isLoadingCoaches &&
              (!humanCoaches || humanCoaches.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No human coaches available yet.
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
