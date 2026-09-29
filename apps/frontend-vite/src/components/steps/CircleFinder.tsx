"use client";

import { defaultPreferences } from "@/components/circles/api";
import { approximateLocation } from "@/components/circles/location";
import { CircleAsk, CirclePrefs } from "@/components/circles/onboarding/CircleSteps";
import { setPendingMatch } from "@/components/circles/pendingMatch";
import type { ApproxLocation, MatchPreferences, PendingMatchMode } from "@/components/circles/types";
import { StickyStepActions } from "@/components/onboarding/sticky-step-actions/StickyStepActions";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { useCurrentUser } from "@/contexts/users";
import { getCoachAvatar } from "@/lib/coachPersonality";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

const STEP_ID = "circle-finder";

// Last onboarding step, once the plan exists: find a circle, invite friends, or go solo.
// Finding and inviting finish onboarding, then hand over to the match screen.
const CircleFinder = () => {
  const navigate = useNavigate();
  const { completeStep, planId, selectedPlan, planTimesPerWeek } = useOnboarding();
  const { currentUser, updateUser } = useCurrentUser();
  // Non-null while on "Match me by", after choosing "Find me a circle".
  const [prefs, setPrefs] = useState<MatchPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const location = useRef<ApproxLocation | null>(null);
  const pendingAge = useRef<number | null>(null);
  const circlePlanId = selectedPlan?.id || planId;
  const weeklyTarget = selectedPlan?.timesPerWeek ?? planTimesPerWeek;

  const finishOnboarding = (onCompleted?: () => void) => {
    setBusy(true);
    completeStep(STEP_ID, { partnerType: null }, { complete: true, onCompleted });
  };

  const goToMatch = async (mode: PendingMatchMode, preferences: MatchPreferences) => {
    if (mode === "find" && preferences.wantsAge && pendingAge.current && !currentUser?.age) {
      await updateUser({ updates: { age: pendingAge.current }, muteNotifications: true }).catch(() =>
        toast.error("Couldn't save your age")
      );
    }
    setPendingMatch({
      planId: circlePlanId,
      mode,
      ...preferences,
      location: mode === "find" && preferences.wantsNearby ? (location.current ?? undefined) : undefined,
    });
    finishOnboarding(() => navigate({ to: "/circle-match", search: { planId: circlePlanId } }));
  };

  // Nearby needs a rough location; without it we fall back to time zones.
  const changePrefs = async (next: MatchPreferences) => {
    setPrefs(next);
    if (!next.wantsNearby || prefs?.wantsNearby || location.current) return;
    setLocating(true);
    try {
      location.current = await approximateLocation();
      setLocationDenied(!location.current);
      if (!location.current) setPrefs({ ...next, wantsNearby: false });
    } catch {
      setLocationDenied(true);
      setPrefs({ ...next, wantsNearby: false });
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="w-full max-w-lg space-y-6 pb-32">
      <div className="flex flex-col items-center gap-4 text-center">
        <img
          src={getCoachAvatar(currentUser?.coachPersonality, prefs ? "thinking" : "happyClosed")}
          alt=""
          className="h-32 w-32 object-contain"
        />
        <h2 className="text-[32px] font-bold leading-[38px] tracking-tight text-foreground">
          {prefs ? "Match me by" : "Do it with a group?"}
        </h2>
        {!prefs && (
          <p className="text-[17px] leading-6 text-muted-foreground">
            Up to 8 people with a similar goal. You'll see each other's week.
          </p>
        )}
      </div>

      {prefs ? (
        <>
          <CirclePrefs
            value={prefs}
            onChange={(next) => void changePrefs(next)}
            place={null}
            age={currentUser?.age ?? pendingAge.current}
            weeklyTarget={weeklyTarget}
            locating={locating}
            locationDenied={locationDenied}
            onAge={(age) => {
              pendingAge.current = age;
            }}
          />
          <StickyStepActions
            primaryLabel={busy ? "Saving…" : "Continue"}
            primaryDisabled={busy || locating}
            onPrimaryClick={() => void goToMatch("find", prefs)}
            secondaryLabel="Back"
            onSecondaryClick={() => setPrefs(null)}
          />
        </>
      ) : (
        <CircleAsk
          busy={busy}
          onFind={() => setPrefs({ ...defaultPreferences })}
          onInvite={() => void goToMatch("invite", defaultPreferences)}
          onSolo={() => finishOnboarding()}
        />
      )}
    </div>
  );
};

export default withFadeUpAnimation(CircleFinder);
