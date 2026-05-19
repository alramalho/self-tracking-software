"use client";

import { useApiWithAuth } from "@/api";
import { AICoachFeaturePreview } from "@/components/AICoachFeaturePreview";
import { CoachProfileDrawer } from "@/components/CoachProfileDrawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useQuery } from "@tanstack/react-query";
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
  const showHumanCoachSection = humanCoaches && humanCoaches.length > 0;

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
  return (
    <div className="w-full max-w-lg space-y-5">
      <AICoachFeaturePreview>
        <Button
          onClick={() => handleSelectCoach(null)}
          className="w-full h-12 text-base font-semibold"
        >
          Continue with Oli
        </Button>
      </AICoachFeaturePreview>
      <div className="space-y-3">
        {showHumanCoachSection && (
          <>
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {isLoading ? (
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
                    onClick={() => handleCoachClick(coach)}
                    className="w-full text-left rounded-2xl overflow-hidden relative group cursor-pointer"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${coach.owner.picture || ""})`,
                      }}
                    />
                    <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition-colors" />

                    <div className="relative p-4 text-white">
                      <h3 className="text-lg font-bold mb-2">
                        {coach.owner.name || coach.owner.username}
                      </h3>

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
                            {details.focusDescription && details.focusDescription.length > 33
                              ? details.focusDescription.slice(0, 30) + "..."
                              : details.focusDescription}
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
          </>
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
