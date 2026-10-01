import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import type { DesignOption, PlanDesign, SubgoalQuestion } from "@tsw/prisma/follow-through";
import { Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { errorMessage } from "@/data/api";
import { InterviewFrame } from "../interview/Frame";
import { NumberPicker } from "../interview/NumberPicker";
import { OnboardingArt } from "../interview/OnboardingArt";
import { OnboardingButton } from "../interview/OnboardingButton";
import { StepSequence } from "../interview/StepReveal";
import { designRoutes, nextSubgoal } from "./api";
import { RouteCard } from "./RouteCard";
import { TwoWeeks } from "./TwoWeeks";
import type { DesignSectionProps, DesignStepName } from "./types";

const DECLINE = "No target in mind";

function firstStep(design: PlanDesign): DesignStepName {
  if (design.selected) return "preview";
  if (design.options.length) return "options";
  return design.orientation === "OUTCOME" && !design.asked.length ? "subgoal" : "days";
}

// Section 4, "Your week". Outcome: [one optional question] → days → two routes → the first two weeks.
// Consistency: days only. One simple ask per screen.
export function DesignSection({ design, goal, goalReason, timezone, preview, busy, onChange, onBack, onClose, onDone }: DesignSectionProps) {
  const c = useColors();
  const outcome = design.orientation === "OUTCOME";
  const [step, setStep] = useState<DesignStepName>(() => firstStep(design));
  const [question, setQuestion] = useState<SubgoalQuestion | null>(null);
  const [asking, setAsking] = useState("");
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<unknown>();
  const [working, setWorking] = useState(false);
  const requested = useRef(false);
  const activity = design.activities[0];
  const chosen = design.options.find((o) => o.id === design.selected);

  // The coach may ask one more thing about the goal; most of the time there's nothing to add.
  useEffect(() => {
    if (step !== "subgoal" || question || requested.current) return;
    requested.current = true;
    setWorking(true);
    void nextSubgoal(design, goal, design.baseline.text)
      .then((q) => (q ? setQuestion(q) : setStep("days")))
      .catch((e) => { setError(e); requested.current = false; })
      .finally(() => setWorking(false));
  }, [step, question, design]);

  const save = (next: PlanDesign) => onChange(next);

  async function answerSubgoal(answer: string) {
    if (!question) return;
    const declined = answer === DECLINE || /^(just|no )/i.test(answer);
    const next: PlanDesign = {
      ...design,
      asked: [...design.asked, { question: question.title, answer }],
      goalSpec: declined
        ? design.goalSpec
        : { metric: question.kind, value: null, unit: null, text: answer, chosenByUser: true },
    };
    await save(next);
    setQuestion(null);
    setTyped("");
    setTyping(false);
    requested.current = false;
    // Ask again only if the coach still needs something and the person hasn't declined.
    setStep(declined || next.asked.length >= 2 ? "days" : "subgoal");
  }

  async function generate(from: PlanDesign) {
    setError(undefined);
    if (!outcome) return onDone(from);
    setStep("loading");
    try {
      // Why it matters is context for the coach's tone, not something to store as an answer twice.
      const context = goalReason ? [...from.asked, { question: "Why does it matter?", answer: goalReason }] : from.asked;
      const result = await designRoutes({ ...from, asked: context.slice(-4) }, goal, timezone);
      if (result.status === "ASK" && result.question) {
        setAsking(result.question);
        setStep("ask");
        return;
      }
      const next = { ...from, baseline: result.baseline, options: result.options, startDate: result.startDate, selected: null };
      await save(next);
      setStep("options");
    } catch (e) {
      setError(e);
      setStep("days");
    }
  }

  const progress = {
    current: step === "subgoal" || step === "days" || step === "ask" || step === "loading" ? 4 : step === "options" ? 5 : 6,
    total: 12,
    label: "Your week",
  };
  const back = () => {
    setError(undefined);
    if (step === "preview") return setStep("options");
    if (step === "options") return setStep("days");
    if (step === "ask") return setStep("days");
    if (step === "days" && outcome && design.asked.length) return setStep("subgoal");
    onBack();
  };
  const choose = async (option: DesignOption) => {
    await save({ ...design, selected: option.id });
    setStep("preview");
  };
  const anything = busy || working || step === "loading";

  let body;
  let actions: React.ReactNode = <View />;
  if (step === "subgoal") {
    body = (
      <StepSequence prefix="design-subgoal" style={{ alignItems: "center", gap: 20 }}>
        <OnboardingArt name="goal" size={120} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>
          {question?.title ?? "One moment…"}
        </Text>
        {question && (
          <View style={{ alignSelf: "stretch", gap: 12 }}>
            {question.choices.map((choice) => (
              <Pressable
                key={choice}
                accessibilityRole="button"
                accessibilityLabel={choice}
                disabled={anything}
                onPress={() => void answerSubgoal(choice).catch(setError)}
                style={({ pressed }) => ({ minHeight: 58, justifyContent: "center", paddingHorizontal: 18, borderRadius: 16, backgroundColor: c.card, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>{choice}</Text>
              </Pressable>
            ))}
            {typing ? (
              <TextInput
                testID="subgoal-own"
                accessibilityLabel="Your own answer"
                autoFocus
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={() => typed.trim() && void answerSubgoal(typed.trim()).catch(setError)}
                placeholder="In your own words"
                placeholderTextColor={c.muted}
                returnKeyType="done"
                style={{ minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.card, paddingHorizontal: 18, fontSize: 17, color: c.text }}
              />
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setTyping(true)} style={{ alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: c.muted, fontSize: 15, textDecorationLine: "underline" }}>Write my own</Text>
              </Pressable>
            )}
          </View>
        )}
      </StepSequence>
    );
    actions = typing ? (
      <OnboardingButton label="Continue" disabled={!typed.trim() || anything} onPress={() => void answerSubgoal(typed.trim()).catch(setError)} />
    ) : <View />;
  } else if (step === "days") {
    body = (
      <StepSequence prefix="design-days" style={{ alignItems: "center", gap: 12 }}>
        <OnboardingArt name="rhythm" size={150} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>
          {outcome ? "How many days can you train?" : "How many times a week?"}
        </Text>
        <NumberPicker
          value={design.availableDays}
          onChange={(availableDays) => void save({ ...design, availableDays })}
          disabled={anything}
          min={1}
          max={7}
          unit={outcome ? "days a week" : "times a week"}
          decreaseLabel="Fewer days"
          increaseLabel="More days"
          valueLabel={`${design.availableDays} days a week`}
          testID="design-days"
        />
        {outcome ? (
          <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
            Oli uses every day you give. Helly leaves room to recover.
          </Text>
        ) : (
          <Text style={{ color: c.muted, fontSize: 15, textAlign: "center" }}>
            {activity.emoji} {activity.title}
          </Text>
        )}
      </StepSequence>
    );
    actions = <OnboardingButton label="Continue" disabled={anything} onPress={() => void generate(design)} />;
  } else if (step === "ask") {
    body = (
      <StepSequence prefix="design-ask" style={{ alignItems: "center", gap: 20 }}>
        <OnboardingArt name="rhythm" size={130} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center" }}>{asking}</Text>
        <TextInput
          testID="design-ask-input"
          accessibilityLabel="Your answer"
          value={typed}
          onChangeText={setTyped}
          multiline
          placeholder="In your own words"
          placeholderTextColor={c.muted}
          style={{ alignSelf: "stretch", minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.card, padding: 18, fontSize: 17, color: c.text, textAlignVertical: "top" }}
        />
      </StepSequence>
    );
    actions = (
      <OnboardingButton
        label="Continue"
        disabled={!typed.trim()}
        onPress={() => {
          const next = { ...design, asked: [...design.asked, { question: asking, answer: typed.trim() }] };
          setTyped("");
          void Promise.resolve(save(next)).then(() => generate(next));
        }}
      />
    );
  } else if (step === "loading") {
    body = <Planning />;
  } else if (step === "options") {
    body = (
      <StepSequence prefix="design-options" style={{ gap: 14 }}>
        <View style={{ alignItems: "center", gap: 10, marginBottom: 6 }}>
          <OnboardingArt name="review" size={130} />
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>Choose your plan</Text>
          <Text style={{ color: c.muted, fontSize: 16, textAlign: "center" }}>Same goal. Two ways to get there.</Text>
        </View>
        {design.options.map((option) => (
          <RouteCard key={option.id} option={option} selected={design.selected === option.id} onPress={() => void choose(option)} />
        ))}
        <Pressable accessibilityRole="button" onPress={() => setStep("days")} style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ color: c.muted, fontSize: 15, textDecorationLine: "underline" }}>More / fewer days</Text>
        </Pressable>
      </StepSequence>
    );
  } else if (chosen) {
    body = (
      <StepSequence prefix="design-preview" style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Check size={18} color={c.accent} />
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>
            {chosen.coach} · {chosen.trainingDaysPerWeek} days a week
          </Text>
        </View>
        <TwoWeeks sessions={chosen.sessions} activity={activity} startDate={design.startDate} />
        <Pressable accessibilityRole="button" onPress={() => setStep("options")} style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ color: c.muted, fontSize: 15, textDecorationLine: "underline" }}>Choose the other plan</Text>
        </Pressable>
      </StepSequence>
    );
    actions = <OnboardingButton label="Continue" disabled={busy} onPress={() => onDone(design)} />;
  }
  return (
    <InterviewFrame
      stage="rhythm"
      transitionKey={`design-${step}-${design.asked.length}-${design.selected}`}
      progress={progress}
      preview={preview}
      busy={anything}
      onBack={back}
      onClose={onClose}
      onSkip={step === "subgoal" && question ? () => void answerSubgoal(DECLINE).catch(setError) : undefined}
      actions={actions}
    >
      {body}
      <Status error={error ? new Error(errorMessage(error)) : undefined} retry={() => setError(undefined)} />
    </InterviewFrame>
  );
}

// Helly and Oli at work while the two routes are built.
function Planning() {
  const c = useColors();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View testID="design-loading" style={{ alignItems: "center", gap: 22 }}>
      <Animated.View style={{ flexDirection: "row", gap: 16, opacity: pulse }}>
        <Image source={require("../../../../assets/coaches/helly-3d.png")} style={{ width: 96, height: 96 }} />
        <Image source={require("../../../../assets/coaches/oli-3d.png")} style={{ width: 96, height: 96 }} />
      </Animated.View>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center" }}>
        Planning your two routes
      </Text>
    </View>
  );
}
