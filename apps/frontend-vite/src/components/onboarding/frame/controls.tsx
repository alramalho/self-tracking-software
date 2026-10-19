import { Loader2, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import Lottie from "react-lottie";
import { useThemeColors } from "@/hooks/useThemeColors";
import targetAnimation from "../../../../public/animations/target.lottie.json";
import type {
  CoachAvatarProps,
  NumberPickerProps,
  OnboardingArtName,
  OnboardingArtProps,
  OnboardingButtonProps,
  QuietButtonProps,
  ScreenHeadingProps,
} from "../types";

// The one dominant action on an onboarding screen: full width, rounded, in the theme colour.
export function OnboardingButton({ label, onClick, disabled, busy }: OnboardingButtonProps) {
  const theme = useThemeColors();
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[17px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${theme.bg}`}
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Working" /> : label}
    </button>
  );
}

// Everything else stays quiet next to it: a soft button, or an underlined link.
export function QuietButton({ label, onClick, disabled, variant = "secondary" }: QuietButtonProps) {
  if (variant === "link")
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="self-center py-1.5 text-[15px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        {label}
      </button>
    );
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-[50px] w-full rounded-2xl bg-muted px-4 text-[15px] font-semibold text-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

// Shared by age and days a week, so both feel like the same control.
export function NumberPicker({ value, onChange, min, max, unit, decreaseLabel, increaseLabel, disabled, testId }: NumberPickerProps) {
  const step = (decrease: boolean) => {
    const blocked = disabled || (decrease ? value <= min : value >= max);
    const Icon = decrease ? Minus : Plus;
    return (
      <button
        type="button"
        aria-label={decrease ? decreaseLabel : increaseLabel}
        disabled={blocked}
        onClick={() => onChange(Math.max(min, Math.min(max, value + (decrease ? -1 : 1))))}
        className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-border bg-card text-foreground transition-opacity hover:opacity-70 disabled:opacity-35"
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </button>
    );
  };
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <div className="flex w-[264px] max-w-full items-center justify-between">
        {step(true)}
        <span data-testid={`${testId}-value`} className="min-w-[84px] text-center text-[58px] font-bold leading-[68px] tabular-nums text-foreground">
          {value}
        </span>
        {step(false)}
      </div>
      <span className="text-[13px] font-semibold text-muted-foreground">{unit}</span>
    </div>
  );
}

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
}

const stills: Record<Exclude<OnboardingArtName, "goal">, string> = {
  baseline: "/images/onboarding/start.png",
  motivation: "/images/onboarding/why.png",
  rhythm: "/images/onboarding/week.png",
  review: "/images/onboarding/plan.png",
  match: "/images/onboarding/match.png",
  // A clay "?" for the questions the coach writes itself.
  question: "/images/onboarding/question.png",
};

// The clay illustrations. The goal keeps the animated target, still with Reduce Motion.
export function OnboardingArt({ name, size = 150 }: OnboardingArtProps) {
  const reduced = usePrefersReducedMotion();
  const art = size * 0.78;
  return (
    <div data-testid={`onboarding-art-${name}`} className="flex items-center justify-center self-center" style={{ width: size, height: size }}>
      {name !== "goal" ? (
        <img src={stills[name]} alt="" style={{ width: art, height: art }} className="object-contain" />
      ) : reduced ? (
        <img src="/images/onboarding/target-still.png" alt="" style={{ width: art, height: art }} className="object-contain" />
      ) : (
        <Lottie
          options={{ loop: true, autoplay: true, animationData: targetAnimation }}
          height={art}
          width={art}
          speed={0.45}
          isClickToPauseDisabled
          ariaRole="presentation"
        />
      )}
    </div>
  );
}

export function CoachAvatar({ coach, size }: CoachAvatarProps) {
  return (
    <img
      src={coach === "Oli" ? "/images/onboarding/oli-3d.png" : "/images/onboarding/helly-3d.png"}
      alt=""
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}

export function ScreenHeading({ title, detail, art }: ScreenHeadingProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {art}
      <h1 className="text-balance text-[32px] font-bold leading-[38px] tracking-[-0.02em] text-foreground">{title}</h1>
      {detail && <p className="text-base leading-6 text-muted-foreground">{detail}</p>}
    </div>
  );
}
