import { defaultPreferences } from "@/components/circles/api";
import { CircleAsk, CirclePrefs } from "@/components/circles/onboarding/CircleSteps";
import { Orbit } from "@/components/circles/Orbit";
import type { OrbitPerson } from "@/components/circles/types";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { OnboardingArt } from "../frame/controls";
import type { CircleStepProps } from "../types";

// "Do it with a group?" Tapping a choice moves on; "Find me a circle" opens "Match me by".
export function CircleStep({ prefs, age, weeklyTarget, busy, locating, locationDenied, place, onPrefs, onAge, onInvite, onSolo }: CircleStepProps) {
  const { currentUser } = useCurrentUser();
  const theme = useThemeColors();
  // The circle drifting round its orbit: you, one person already in, and open seats.
  const people: OrbitPerson[] = [
    { key: "me", label: currentUser?.name ?? currentUser?.username ?? "You", color: theme.hex, picture: currentUser?.picture, isMe: true },
    { key: "m1", label: "A", color: "#c77d2e" },
    { key: "e1", label: "", color: "", empty: true },
    { key: "e2", label: "", color: "", empty: true },
  ];
  return (
    <>
      <div className="flex flex-col items-center gap-4 text-center">
        {prefs ? (
          <OnboardingArt name="match" size={170} />
        ) : (
          <div className="-mx-7 -mt-6 w-[calc(100%+3.5rem)]">
            <Orbit people={people} height={190} />
          </div>
        )}
        <h1 className="text-[32px] font-bold leading-[38px] tracking-[-0.02em] text-foreground">{prefs ? "Match me by" : "Do it with a group?"}</h1>
        {!prefs && <p className="text-[17px] leading-6 text-muted-foreground">Up to 8 people with a similar goal. You'll see each other's week.</p>}
      </div>
      {prefs ? (
        <CirclePrefs
          value={prefs}
          onChange={onPrefs}
          place={place}
          age={age}
          weeklyTarget={weeklyTarget}
          locating={locating}
          locationDenied={locationDenied}
          onAge={onAge}
        />
      ) : (
        <CircleAsk busy={busy} onFind={() => onPrefs({ ...defaultPreferences })} onInvite={onInvite} onSolo={onSolo} />
      )}
    </>
  );
}
