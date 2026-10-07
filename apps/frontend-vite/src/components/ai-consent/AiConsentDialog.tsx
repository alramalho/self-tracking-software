import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { useApiWithAuth } from "@/api";
import { useCurrentUser } from "@/contexts/users";
import { onAiConsentRequired } from "@/lib/api";
import type { AiConsentFields } from "./types";

// AI data sharing consent, same words as the iPhone app (App Store 5.1.2(i)).
// Nothing goes to an AI provider until the person allows it; the server
// enforces the same rule (backend utils/aiConsent.ts).
const sent = [
  "Your messages and voice recordings",
  "Your first name and age",
  "Plan goals, notes and your answers when setting up a plan",
  "Activity logs, notes and metrics",
  "Photos you send to the coach",
  "Workouts and sleep, only for plans where you allow it",
];
const receivers = [
  "OpenAI, DeepSeek, Google, Anthropic and Moonshot, through Vercel AI Gateway, and the companies that host their models",
  "Similar-plan matching: OpenAI",
  "Speech to text: OpenRouter or OpenAI",
  "Plan research, web search and browsing: Perplexity, and Browserbase with the AI model it uses",
  "Coach memory: Supermemory",
];

export function aiAllowed(user?: AiConsentFields) {
  const granted = user?.aiConsentGrantedAt;
  const declined = user?.aiConsentDeclinedAt;
  if (!granted) return false;
  return !declined || new Date(granted) > new Date(declined);
}

// Mounted once for signed-in people. Asks those never asked, once, and asks
// again whenever the server says AI features are off.
export function AiConsentGate() {
  const api = useApiWithAuth();
  const client = useQueryClient();
  const { currentUser } = useCurrentUser();
  const user = currentUser as (typeof currentUser & AiConsentFields) | undefined;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);
  useEffect(() => onAiConsentRequired(() => setOpen(true)), []);
  useEffect(() => {
    if (!user || asked.current) return;
    asked.current = true;
    if (!user.aiConsentGrantedAt && !user.aiConsentDeclinedAt) setOpen(true);
  }, [user]);
  async function choose(granted: boolean) {
    setBusy(true);
    try {
      await api.put("/users/ai-consent", { granted });
      await client.refetchQueries({ queryKey: ["current-user"] });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }
  if (!open) return null;
  return (
    <AppleLikePopover open onClose={() => void choose(false)} title="Allow AI features?">
      <div className="flex flex-col gap-4 pt-2 text-sm">
        <h2 className="text-lg font-bold">Allow AI features?</h2>
        <p className="text-muted-foreground">
          Your coach, plan setup, voice logs and dictation use AI. To run them, tracking.so sends
          some of your data to AI providers.
        </p>
        <div>
          <p className="font-semibold text-muted-foreground">What we send</p>
          <ul className="list-disc pl-5">{sent.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground">Who receives it</p>
          <ul className="list-disc pl-5">{receivers.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <p className="text-muted-foreground">
          It&apos;s used only to run the features you use, never to sell your data or for ads.
          Manual tracking works without it, and you can change this anytime in Settings.
        </p>
        <a href="https://tracking.so/privacy" target="_blank" rel="noreferrer" className="font-semibold text-primary">
          Read our privacy policy
        </a>
        <Button disabled={busy} onClick={() => void choose(true)}>
          {busy ? "Saving…" : "Allow"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void choose(false)}>
          Not now
        </Button>
      </div>
    </AppleLikePopover>
  );
}
