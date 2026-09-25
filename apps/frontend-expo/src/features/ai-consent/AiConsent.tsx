import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useSession } from "@/auth/provider";
import { api, setAiConsentRequiredHandler } from "@/data/api";
import { useCurrentUser, usePlans } from "@/data/queries";
import type { User } from "@/core/types";
import {
  PreviewButton,
  PreviewSheet,
} from "@/features/messages/entities/PreviewSheet";
import type { AiConsent, AiConsentChoice, AiConsentSheetProps } from "./types";

// AI data sharing consent (App Store Guideline 5.1.2(i)). Nothing is sent to an
// AI provider until the person taps Allow. The server enforces the same rule
// (backend utils/aiConsent.ts). Change the lists below when providers change.
const PRIVACY_URL = "https://tracking.so/privacy";
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

export function aiAllowed(user?: User) {
  const granted = user?.aiConsentGrantedAt;
  const declined = user?.aiConsentDeclinedAt;
  if (!granted) return false;
  return !declined || new Date(granted) > new Date(declined);
}

export function useAiConsent(): AiConsent {
  const auth = useSession();
  const user = useCurrentUser(auth.isSignedIn);
  const client = useQueryClient();
  const allowed = aiAllowed(user.data);
  const [answer, setAnswer] = useState<(granted: boolean) => void>();
  const save = useMutation({
    mutationFn: async (granted: boolean) =>
      (await api.put<AiConsentChoice>("/users/ai-consent", { granted })).data,
    onSuccess: (choice) =>
      client.setQueryData<User>(
        ["current-user"],
        (current) => current && { ...current, ...choice },
      ),
  });
  const ask = useCallback(
    () =>
      allowed
        ? Promise.resolve(true)
        : new Promise<boolean>((resolve) => setAnswer(() => resolve)),
    [allowed],
  );
  const finish = (granted: boolean) => {
    answer?.(granted);
    setAnswer(undefined);
    save.reset();
  };
  const choose = (granted: boolean) => {
    if (granted) save.mutate(true, { onSuccess: () => finish(true) });
    else {
      save.mutate(false);
      finish(false);
    }
  };
  return {
    allowed,
    ask,
    sheet: (
      <AiConsentSheet
        visible={!!answer}
        busy={save.isPending}
        error={save.error}
        onChoose={choose}
        onClose={() => finish(false)}
      />
    ),
  };
}

// Mounted once in the app layout. Asks people who were never asked, once, and
// asks again whenever the server says AI features are off.
export function AiConsentGate() {
  const auth = useSession();
  const user = useCurrentUser(auth.isSignedIn);
  const plans = usePlans(auth.isSignedIn);
  const consent = useAiConsent();
  const asked = useRef(false);
  const { ask } = consent;
  useEffect(() => setAiConsentRequiredHandler(() => void ask()), [ask]);
  useEffect(() => {
    if (!user.data || !plans.data || asked.current) return;
    // New people are asked by onboarding, right before the interview.
    const isNew = !user.data.onboardingCompletedAt && !plans.data.length;
    const answered =
      !!user.data.aiConsentGrantedAt || !!user.data.aiConsentDeclinedAt;
    if (isNew || answered) return;
    asked.current = true;
    void ask();
  }, [user.data, plans.data, ask]);
  return consent.sheet;
}

function AiConsentSheet({
  visible,
  busy,
  error,
  onChoose,
  onClose,
}: AiConsentSheetProps) {
  const c = useColors();
  const list = (items: string[]) =>
    items.map((item) => (
      // Bullet in its own column so wrapped lines stay indented.
      <View key={item} style={{ flexDirection: "row", gap: 8 }}>
        <Text style={{ color: c.text, lineHeight: 22 }}>•</Text>
        <Text style={{ color: c.text, lineHeight: 22, flex: 1 }}>{item}</Text>
      </View>
    ));
  const heading = (title: string) => (
    <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
      {title}
    </Text>
  );
  return (
    <PreviewSheet visible={visible} title="Allow AI features?" onClose={onClose}>
      <Text
        accessibilityRole="header"
        style={{ color: c.text, fontSize: 18, fontWeight: "700", paddingRight: 40 }}
      >
        Allow AI features?
      </Text>
      <Copy muted>
        Your coach, plan setup, voice logs and dictation use AI. To run them,
        tracking.so sends some of your data to AI providers.
      </Copy>
      <View style={{ gap: 4 }}>
        {heading("What we send")}
        {list(sent)}
      </View>
      <View style={{ gap: 4 }}>
        {heading("Who receives it")}
        {list(receivers)}
      </View>
      <Copy muted>
        It's used only to run the features you use, never to sell your data or
        for ads. Manual tracking works without it, and you can change this
        anytime in Settings.
      </Copy>
      <Text
        accessibilityRole="link"
        onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})}
        style={{ color: c.accent, fontWeight: "600" }}
      >
        Read our privacy policy
      </Text>
      <Status error={error} />
      <PreviewButton
        label={busy ? "Saving…" : "Allow"}
        disabled={busy}
        onPress={() => onChoose(true)}
      />
      <PreviewButton
        label="Not now"
        secondary
        disabled={busy}
        onPress={() => onChoose(false)}
      />
    </PreviewSheet>
  );
}
