import { Sparkles } from "lucide-react";
import { useThemeColors } from "@/hooks/useThemeColors";
import { OnboardingButton, QuietButton, ScreenHeading } from "../frame/controls";
import { OnboardingFrame } from "../frame/OnboardingFrame";
import type { AiConsentStepProps, ConsentListProps } from "../types";

// The same disclosure as the app's "Allow AI features?" sheet (frontend-expo ai-consent).
// Nothing is sent to an AI provider before the person allows it.
const sent = [
  "Your messages and voice recordings",
  "Plan goals and notes",
  "Activity logs, notes and metrics",
  "Photos you send to the coach",
  "Workouts and sleep, only for plans where you allow it",
];
const receivers = [
  "OpenAI, DeepSeek, Google, Anthropic and Moonshot, through Vercel AI Gateway",
  "Speech to text: OpenAI or OpenRouter",
  "Web search and browsing for the coach: Perplexity and Browserbase",
  "Coach memory: Supermemory",
];

function List({ title, items }: ConsentListProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[13px] font-semibold text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[15px] leading-[22px] text-foreground">
            <span aria-hidden>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiConsentStep({ busy, onAllow, onDecline }: AiConsentStepProps) {
  const theme = useThemeColors();
  return (
    <OnboardingFrame
      screenKey="consent"
      progress={{ current: 1, total: 1 }}
      busy={busy}
      actions={
        <>
          <OnboardingButton label="Allow AI features" busy={busy} onClick={onAllow} />
          <QuietButton label="Create a plan by hand" disabled={busy} onClick={onDecline} />
        </>
      }
    >
      <ScreenHeading
        art={<Sparkles className={`h-20 w-20 ${theme.text}`} strokeWidth={1.4} />}
        title="This setup uses AI"
        detail="Your coach asks a few questions and drafts your plan with AI. Allow AI features to continue, or create a plan yourself and track it by hand."
      />
      <div className="flex flex-col gap-4 rounded-2xl bg-card p-5">
        <List title="What we send" items={sent} />
        <List title="Who receives it" items={receivers} />
        <p className="text-[13px] leading-5 text-muted-foreground">
          It's used only to run the features you use, never to sell your data or for ads. You can change this anytime in Settings.{" "}
          <a href="https://tracking.so/privacy" target="_blank" rel="noreferrer" className={`font-semibold ${theme.text}`}>
            Read our privacy policy
          </a>
        </p>
      </div>
    </OnboardingFrame>
  );
}
