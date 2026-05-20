export type CoachPersonality = "CHAMPION" | "STRATEGIST";

export type CoachPersonalityConfig = {
  id: CoachPersonality;
  name: string;
  title: string;
  label: string;
  shortChoice: string;
  description: string;
  avatar: string;
  accentClassName: string;
};

export type CoachAvatarEmotion =
  | "neutral"
  | "happyClosed"
  | "sad"
  | "surprised"
  | "angry"
  | "thinking"
  | "sleepy"
  | "wink"
  | "skeptical"
  | "excited"
  | "shy"
  | "listening"
  | "coachNeutral"
  | "coachSpeaking"
  | "coachSmiling"
  | "coachExcited";

const avatarEmotionFiles: Record<CoachAvatarEmotion, string> = {
  neutral: "01_neutral.png",
  happyClosed: "02_happy_closed.png",
  sad: "03_sad.png",
  surprised: "04_surprised.png",
  angry: "05_angry.png",
  thinking: "06_thinking.png",
  sleepy: "07_sleepy.png",
  wink: "08_wink.png",
  skeptical: "09_skeptical.png",
  excited: "10_excited.png",
  shy: "11_shy.png",
  listening: "12_listening.png",
  coachNeutral: "13_coach_neutral.png",
  coachSpeaking: "14_coach_speaking.png",
  coachSmiling: "15_coach_smiling.png",
  coachExcited: "16_coach_excited.png",
};

export const DEFAULT_COACH_PERSONALITY: CoachPersonality = "CHAMPION";

export const coachPersonalityOptions: CoachPersonalityConfig[] = [
  {
    id: "CHAMPION",
    name: "Helly",
    title: "The Champion",
    label: "Helly, the Champion",
    shortChoice: "Pull me forward with encouragement",
    description:
      "Warm, encouraging, and gain-focused. Leads with vision, progress, and the next step.",
    avatar: "/images/coaches/helly/01_neutral.png",
    accentClassName: "border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/20",
  },
  {
    id: "STRATEGIST",
    name: "Oli",
    title: "The Strategist",
    label: "Oli, the Strategist",
    shortChoice: "Keep me honest with direct strategy",
    description:
      "Direct, realistic, and obstacle-focused. Leads with the gap, the risk, and the plan.",
    avatar: "/images/coaches/oli/01_neutral.png",
    accentClassName: "border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40",
  },
];

export function normalizeCoachPersonality(value?: string | null): CoachPersonality {
  return value === "STRATEGIST" ? "STRATEGIST" : DEFAULT_COACH_PERSONALITY;
}

export function getCoachPersonalityConfig(value?: string | null): CoachPersonalityConfig {
  const personality = normalizeCoachPersonality(value);
  return coachPersonalityOptions.find((option) => option.id === personality) || coachPersonalityOptions[0];
}

export function getCoachAvatar(
  value?: string | null,
  emotion: CoachAvatarEmotion = "neutral"
): string {
  const config = getCoachPersonalityConfig(value);
  const folder = config.id === "STRATEGIST" ? "oli" : "helly";
  return `/images/coaches/${folder}/${avatarEmotionFiles[emotion]}`;
}
