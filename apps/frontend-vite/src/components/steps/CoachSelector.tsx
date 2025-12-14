"use client";

import { useApiWithAuth } from "@/api";
import { CoachProfileDrawer } from "@/components/CoachProfileDrawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles, User } from "lucide-react";
import { useState } from "react";

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

const CoachSelector = () => {
  const { completeStep, setSelectedCoachId } = useOnboarding();
  const api = useApiWithAuth();

  // State for coach profile drawer
  const [selectedCoachForPreview, setSelectedCoachForPreview] =
    useState<HumanCoach | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: humanCoaches, isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const response = await api.get<HumanCoach[]>("/coaches");
      return response.data;
    },
  });

  const handleSelectCoach = (coachId: string | null) => {
    // Find the selected coach to pass full info
    const selectedCoach = coachId
      ? humanCoaches?.find((c) => c.id === coachId)
      : null;

    const coachInfo = selectedCoach
      ? {
          id: selectedCoach.id,
          name: selectedCoach.owner.name,
          username: selectedCoach.owner.username,
          picture: selectedCoach.owner.picture,
          title: selectedCoach.details.title,
        }
      : null;

    setSelectedCoachId(coachId, coachInfo);
    completeStep("coach-selector", {
      selectedCoachId: coachId,
      selectedCoach: coachInfo,
    });
  };

  const handleCoachClick = (coach: HumanCoach) => {
    setSelectedCoachForPreview(coach);
    setIsDrawerOpen(true);
  };

  const coachIcon = "/images/jarvis_logo_blue_transparent.png"

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Sparkles className="w-16 h-16 text-blue-600" />
          <h2 className="text-2xl mt-2 font-bold tracking-tight text-foreground">
            Choose your coach
          </h2>
        </div>
        <p className="text-md text-muted-foreground">
          Select an AI coach for free or work with a human coach for personalized guidance.
        </p>
      </div>

      <div className="space-y-4">
        {/* AI Coach Option */}
        <button
          onClick={() => handleSelectCoach(null)}
          className="w-full rounded-xl border-2 border-border p-5 text-left transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-transparent text-blue-500 flex items-center justify-center flex-shrink-0">
              <img src={coachIcon} alt="AI Coach" className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground">
                AI Coach
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Research-backed activities with adaptive scheduling
              </p>
              <ul className="mt-3 space-y-1">
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  Personalized activity suggestions
                </li>
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  Available 24/7
                </li>
              </ul>
              <div className="mt-3 inline-block bg-muted text-foreground px-3 py-1 rounded-full text-sm font-medium">
                Free trial, then €9.99/m
              </div>
            </div>
          </div>
        </button>

        {/* Human Coaches */}
        {isLoading ? (
          <>
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border-2 border-border p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="w-14 h-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          humanCoaches?.map((coach) => {
            const details = coach.details;

            return (
              <button
                key={coach.id}
                onClick={() => handleCoachClick(coach)}
                className="w-full rounded-xl border-2 border-border p-5 text-left transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="w-14 h-14 flex-shrink-0">
                    <AvatarImage src={coach.owner.picture || undefined} />
                    <AvatarFallback>
                      <User className="w-6 h-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground">
                      {coach.owner.name || coach.owner.username}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {details.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {details.focusDescription}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}

        {!isLoading && (!humanCoaches || humanCoaches.length === 0) && (
          <p className="text-center text-muted-foreground text-sm py-4">
            No human coaches available yet. Choose AI coaching to get started!
          </p>
        )}
      </div>

      {/* Coach Profile Drawer */}
      <CoachProfileDrawer
        coach={selectedCoachForPreview}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectCoach={handleSelectCoach}
      />
    </div>
  );
};

export default withFadeUpAnimation(CoachSelector);
