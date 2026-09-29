import { Input } from "@/components/ui/input";
import { Mail, User, Users } from "lucide-react";
import { MatchPreferencesList } from "../components";
import type { CircleAskOption, CircleAskProps, CirclePrefsProps } from "../types";

// "Do it with a group?" Tapping a choice moves on, like the coaching question.
export function CircleAsk({ busy, onFind, onInvite, onSolo }: CircleAskProps) {
  const options: CircleAskOption[] = [
    { label: "Find me a circle", icon: Users, onPress: onFind },
    { label: "Invite friends", icon: Mail, onPress: onInvite },
    { label: "Just me", icon: User, onPress: onSolo },
  ];
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          disabled={busy}
          onClick={option.onPress}
          className="flex min-h-[64px] w-full items-center gap-4 rounded-2xl bg-card border border-border px-[18px] text-left transition-opacity hover:opacity-80 disabled:opacity-60"
        >
          <option.icon className="h-6 w-6 text-foreground" strokeWidth={1.8} />
          <span className="text-[17px] font-semibold text-foreground">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

// "Match me by": the four levers. Nearby asks for location; age asks for an age if we don't have one.
export function CirclePrefs({
  value,
  onChange,
  place,
  age,
  weeklyTarget,
  locating,
  locationDenied,
  onAge,
}: CirclePrefsProps) {
  return (
    <div className="flex flex-col gap-3">
      <MatchPreferencesList
        value={value}
        onChange={onChange}
        place={locating ? "Finding your area…" : place}
        age={age}
        weeklyTarget={weeklyTarget}
      />
      {value.wantsAge && !age && (
        <Input
          aria-label="Your age"
          inputMode="numeric"
          maxLength={3}
          placeholder="Your age"
          className="h-[52px] rounded-[14px] text-[17px]"
          onChange={(event) => {
            const n = Number.parseInt(event.target.value, 10);
            if (n >= 13 && n <= 120) onAge(n);
          }}
        />
      )}
      <p className="text-center text-sm text-muted-foreground">
        {locationDenied
          ? "Location is off, so we'll match by time zone instead."
          : "Others only see “same city”."}
      </p>
    </div>
  );
}
