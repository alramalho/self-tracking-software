import { CalendarDays, CheckCircle2, Loader2, Target, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/contexts/users";
import api from "@/lib/api";
import { NumberPicker, OnboardingArt, OnboardingButton } from "../frame/controls";
import { OnboardingFrame } from "../frame/OnboardingFrame";
import type { ProfileSetupProps, WelcomeProps, WelcomeStepName } from "../types";

const validAge = (age?: number | null) => !!age && age >= 13 && age <= 120;

// What the app focuses on, a username for new web sign-ups, then their age for circle matching.
export function Welcome({ savedAge, needsUsername, busy, onContinue }: WelcomeProps) {
  const [step, setStep] = useState<WelcomeStepName>("intro");
  const [age, setAge] = useState(validAge(savedAge) ? savedAge! : 25);
  const back = step === "age" && needsUsername ? () => setStep("profile") : step !== "intro" ? () => setStep("intro") : undefined;
  return (
    <OnboardingFrame
      screenKey={`welcome-${step}`}
      bare
      busy={busy}
      onBack={back}
      actions={
        step === "intro" ? (
          <OnboardingButton label="I'm ready!" onClick={() => setStep(needsUsername ? "profile" : "age")} />
        ) : step === "age" ? (
          <OnboardingButton label="Continue" busy={busy} onClick={() => onContinue(age)} />
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-2.5 text-center">
        <OnboardingArt name="goal" size={120} />
        <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-foreground">Welcome to tracking.so</h1>
      </div>
      {step === "intro" && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-base leading-[22px] text-muted-foreground">
            Tracking Software is a year-old app, built from the ground up to help you stay more consistent. We’ll focus on:
          </p>
          <div className="overflow-hidden rounded-2xl bg-card">
            {[
              { icon: Target, label: "Your goal" },
              { icon: CalendarDays, label: "Your week" },
              { icon: Users, label: "Coach and circle" },
            ].map((row, i) => (
              <div key={row.label} className={`flex min-h-12 items-center gap-3.5 px-4 ${i ? "border-t border-border" : ""}`}>
                <row.icon className="h-[22px] w-[22px] text-foreground" strokeWidth={1.8} />
                <span className="text-[17px] text-foreground">{row.label}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-base leading-[22px] text-muted-foreground">
            Naturally, most of the work will come from you. Are you ready?
          </p>
        </div>
      )}
      {step === "profile" && <ProfileSetup onDone={() => setStep("age")} />}
      {step === "age" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-foreground">What is your age?</h2>
          <p className="text-base leading-6 text-muted-foreground">This helps us find people of a similar age.</p>
          <NumberPicker
            value={age}
            onChange={setAge}
            min={13}
            max={120}
            unit="years old"
            decreaseLabel="Decrease age"
            increaseLabel="Increase age"
            disabled={busy}
            testId="onboarding-welcome-age"
          />
        </div>
      )}
    </OnboardingFrame>
  );
}

// People who sign up on the web with Google or Apple have no username yet.
function ProfileSetup({ onDone }: ProfileSetupProps) {
  const { currentUser, updateUser } = useCurrentUser();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setAvailable(null);
    if (username.length < 3) {
      setProblem(username ? "Username must be at least 3 characters" : null);
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      setProblem("Use lowercase letters, numbers and underscores");
      return;
    }
    setProblem(null);
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users/check-username/${username}`);
        setAvailable(!data.exists);
        if (data.exists) setProblem("Username is already taken");
      } catch {
        setProblem("Couldn't check this username. Try again.");
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const save = async () => {
    setSaving(true);
    try {
      await updateUser({ updates: { username, ...(name.trim() && { name: name.trim() }) }, muteNotifications: true });
      onDone();
    } catch {
      setProblem("Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const Status = checking ? Loader2 : available ? CheckCircle2 : XCircle;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (available && !saving) void save();
      }}
    >
      <h2 className="text-center text-[26px] font-bold leading-8 tracking-[-0.02em] text-foreground">Set up your profile</h2>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted-foreground">
        Your name
        <Input id="onboarding-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="h-[52px] rounded-[14px] text-[17px]" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted-foreground">
        Username
        <div className="relative">
          <Input
            id="onboarding-username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="Choose a username"
            autoComplete="off"
            className="h-[52px] rounded-[14px] pr-11 text-[17px]"
          />
          {username.length >= 3 && (
            <Status
              className={`absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 ${checking ? "animate-spin text-muted-foreground" : available ? "text-green-600" : "text-destructive"}`}
            />
          )}
        </div>
      </label>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
      <OnboardingButton label="Continue" busy={saving} disabled={!available || checking} onClick={() => void save()} />
    </form>
  );
}
