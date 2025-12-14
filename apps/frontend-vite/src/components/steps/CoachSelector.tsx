"use client";

import { useApiWithAuth } from "@/api";
import { CoachProfileDrawer } from "@/components/CoachProfileDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useQuery } from "@tanstack/react-query";
import { LandPlot, Route, Send, Sparkles } from "lucide-react";
import React, { useState } from "react";

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
    <div className="w-full max-w-lg space-y-6">
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
          icon={<Route className="w-5 h-5 text-blue-500" />}
          title="Weekly plan adjustments based on progress"
        />
      </div>

      <div className="space-y-3">
        {/* AI Coach Option */}
        <button
          onClick={() => handleSelectCoach(null)}
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
              <img src={coachIcon} alt="AI Coach" className="w-8 h-8 brightness-0 invert" />
              <h3 className="text-lg font-bold">Oli</h3>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/60">
                  Type
                </p>
                <p className="text-sm font-semibold">
                  AI Coach
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/60">
                  Availability
                </p>
                <p className="text-sm font-semibold">
                  24/7
                </p>
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
          <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Human Coaches */}
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

        {!isLoading && (!humanCoaches || humanCoaches.length === 0) && (
          <p className="text-center text-muted-foreground text-sm py-4">
            No human coaches available yet.
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
