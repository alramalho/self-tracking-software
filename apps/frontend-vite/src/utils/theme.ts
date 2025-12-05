import { ThemeColor } from "@tsw/prisma";

export type BaseLoweredThemeColor = Exclude<Lowercase<ThemeColor>, "random">;
export type LowerThemeColor = Lowercase<ThemeColor>;
// All possible theme variants
export interface ThemeVariants {
  // Basic colors
  raw: BaseLoweredThemeColor; // Raw color name
  hex: string;
  brightHex: string;
  bg: string;
  veryFadedBg: string;
  fadedBg: string;
  hardGradientBg: string;
  softGradientBg: string;
  verySoftGrandientBg: string;
  text: string;
  ring: string;
  ringSoft: string;
  ringBright: string;
  ringOffset: string;
  border: string;
  brightBorder: string;
  fadedText: string;
  veryFadedText: string;
  primary: string;
  secondary: string;
  accent: string;
  hover: string;
  background: string;

  // Component specific
  card: {
    selected: {
      border: string;
      bg: string;
      glassBg: string;
    };
    glassBg: string;
    softGlassBg: string;
  };
  button: {
    solid: string;
    glass: string;
    outline: string;
    ghost: string;
  };
  indicator: {
    active: string;
    inactive: string;
  };
}

// Force Tailwind to generate all theme classes
export const themeVariants: Record<
  Exclude<BaseLoweredThemeColor, "random">,
  ThemeVariants
> = {
  slate: {
    raw: "slate",
    hex: "#64748b",
    brightHex: "#94a3b8",
    bg: "bg-slate-500 dark:bg-slate-400",
    hardGradientBg: "bg-gradient-to-r from-slate-500 to-slate-600",
    softGradientBg:
      "bg-gradient-to-r from-gray-100/20 to-slate-50 backdrop-blur-sm",
    verySoftGrandientBg:
      "bg-gradient-to-r from-transparent to-slate-50/60 dark:from-transparent dark:to-slate-900/60 backdrop-blur-sm",
    veryFadedBg: "bg-slate-50 dark:bg-slate-600/30",
    fadedBg: "bg-slate-200/50 dark:bg-slate-800/50",
    text: "text-slate-500",
    ring: "ring-gray-500",
    ringSoft: "ring-gray-200",
    ringBright: "ring-slate-300 dark:ring-slate-700",
    ringOffset: "ring-offset-slate-50 dark:ring-offset-slate-900",
    fadedText: "text-slate-500/50",
    veryFadedText: "text-slate-200/50 dark:text-slate-800/50",
    brightBorder: "border-slate-200 dark:border-slate-800",
    border: "border-slate-400",
    primary: "bg-slate-500",
    secondary: "bg-slate-400",
    accent: "bg-slate-300",
    hover: "hover:bg-slate-100",
    background: "bg-slate-50",
    card: {
      selected: {
        border: "border-slate-400",
        bg: "bg-slate-100 dark:bg-slate-800/50",
        glassBg: "bg-slate-100/70 dark:bg-slate-800/70",
      },
      glassBg: "bg-slate-100/40 dark:bg-slate-800/40",
      softGlassBg: "bg-slate-50/60 dark:bg-slate-800/60",
    },
    button: {
      solid: "bg-slate-500 hover:bg-slate-600",
      outline:
        "border-slate-500 text-slate-500 hover:bg-slate-50 hover:text-slate-700",
      glass:
        "bg-slate-100/40 dark:bg-slate-800/40 text-slate-500 hover:bg-slate-50 hover:text-slate-700",
      ghost: "text-slate-500 hover:bg-slate-50",
    },
    indicator: {
      active: "bg-slate-500",
      inactive: "bg-slate-200",
    },
  },
  blue: {
    raw: "blue",
    hex: "#3b82f6",
    brightHex: "#00bcff",
    bg: "bg-blue-500",
    hardGradientBg: "bg-gradient-to-r from-blue-500 to-blue-600",
    softGradientBg:
      "bg-gradient-to-r from-gray-100/20 to-blue-50 backdrop-blur-sm",
    verySoftGrandientBg:
      "bg-gradient-to-r from-transparent to-blue-50/60 dark:from-transparent dark:to-blue-900/60 backdrop-blur-sm",
    fadedBg: "bg-blue-200/50 dark:bg-blue-800/50",
    veryFadedBg: "bg-blue-50 dark:bg-blue-600/30",
    text: "text-blue-500",
    ring: "ring-blue-500",
    ringSoft: "ring-blue-200",
    ringBright: "ring-blue-300 dark:ring-blue-700",
    ringOffset: "ring-offset-blue-50 dark:ring-offset-blue-900",
    fadedText: "text-blue-500/50",
    veryFadedText: "text-blue-200/50 dark:text-blue-800/50",
    brightBorder: "border-blue-200 dark:border-blue-800",
    border: "border-blue-400",
    primary: "bg-blue-500",
    secondary: "bg-blue-400",
    accent: "bg-blue-300",
    hover: "hover:bg-blue-100",
    background: "bg-blue-50",
    card: {
      selected: {
        border: "border-blue-400 dark:border-blue-600",
        bg: "bg-blue-100 dark:bg-blue-800/50",
        glassBg: "bg-blue-100/70 dark:bg-blue-800/70",
      },
      glassBg: "bg-blue-100/40 dark:bg-blue-800/40",
      softGlassBg: "bg-blue-50/60 dark:bg-blue-800/60",
    },
    button: {
      solid: "bg-blue-500 hover:bg-blue-600",
      outline:
        "border-blue-500 text-blue-500 hover:bg-blue-50 hover:text-blue-700",
      glass:
        "bg-blue-100/40 dark:bg-blue-800/40 text-blue-500 hover:bg-blue-50 hover:text-blue-700",
      ghost: "text-blue-500 hover:bg-blue-50",
    },
    indicator: {
      active: "bg-blue-500",
      inactive: "bg-blue-200",
    },
  },
  violet: {
    raw: "violet",
    hex: "#818cf8",
    brightHex: "#a5b4fc",
    bg: "bg-violet-500",
    hardGradientBg: "bg-gradient-to-r from-violet-500 to-violet-600",
    softGradientBg:
      "bg-gradient-to-r from-gray-100/20 to-violet-50 backdrop-blur-sm",
    verySoftGrandientBg:
      "bg-gradient-to-r from-transparent to-violet-50/60 dark:from-transparent dark:to-violet-900/60 backdrop-blur-sm",
    fadedBg: "bg-violet-100 dark:bg-violet-800/50",
    veryFadedBg: "bg-violet-50 dark:bg-violet-600/30",
    text: "text-violet-500",
    ring: "ring-violet-500",
    ringSoft: "ring-violet-200",
    ringBright: "ring-violet-300 dark:ring-violet-700",
    ringOffset: "ring-offset-violet-50 dark:ring-offset-violet-900",
    fadedText: "text-violet-500/50",
    veryFadedText: "text-violet-200/30 dark:text-violet-800/30",
    brightBorder: "border-violet-200 dark:border-violet-800",
    border: "border-violet-500",
    primary: "bg-violet-500",
    secondary: "bg-violet-400",
    accent: "bg-violet-300",
    hover: "hover:bg-violet-100",
    background: "bg-violet-50",
    card: {
      selected: {
        border: "border-violet-500 dark:border-violet-600",
        bg: "bg-violet-50 dark:bg-violet-800/50",
        glassBg: "bg-violet-100/70 dark:bg-violet-800/70",
      },
      glassBg: "bg-violet-100/40 dark:bg-violet-800/40",
      softGlassBg: "bg-violet-50/60 dark:bg-violet-800/60",
    },
    button: {
      solid: "bg-violet-500 hover:bg-violet-600",
      outline:
        "border-violet-500 text-violet-500 hover:bg-violet-50 hover:text-violet-700",
      glass:
        "bg-violet-100/40 dark:bg-violet-800/40 text-violet-500 hover:bg-violet-50 hover:text-violet-700",
      ghost: "text-violet-500 hover:bg-violet-50",
    },
    indicator: {
      active: "bg-violet-500",
      inactive: "bg-violet-200",
    },
  },
  amber: {
    raw: "amber",
    hex: "#f59e0b",
    brightHex: "#fcd34d",
    bg: "bg-amber-500",
    hardGradientBg: "bg-gradient-to-r from-amber-500 to-amber-600",
    softGradientBg:
      "bg-gradient-to-r from-gray-100/20 to-amber-50 backdrop-blur-sm",
    verySoftGrandientBg:
      "bg-gradient-to-r from-transparent to-amber-50/60 dark:from-transparent dark:to-amber-900/60 backdrop-blur-sm",
    fadedBg: "bg-amber-100 dark:bg-amber-800/50",
    veryFadedBg: "bg-amber-50 dark:bg-amber-600/30",
    text: "text-amber-500",
    ring: "ring-amber-500",
    ringSoft: "ring-amber-200",
    ringBright: "ring-amber-300 dark:ring-amber-700",
    ringOffset: "ring-offset-amber-50 dark:ring-offset-amber-900",
    fadedText: "text-amber-500/50",
    veryFadedText: "text-amber-200/30 dark:text-amber-800/30",
    brightBorder: "border-amber-200 dark:border-amber-800",
    border: "border-amber-400",
    primary: "bg-amber-500",
    secondary: "bg-amber-400",
    accent: "bg-amber-300",
    hover: "hover:bg-amber-100",
    background: "bg-amber-50",
    card: {
      selected: {
        border: "border-amber-400 dark:border-amber-600",
        bg: "bg-amber-50 dark:bg-amber-800/50",
        glassBg: "bg-amber-100/70 dark:bg-amber-800/70",
      },
      glassBg: "bg-amber-100/40 dark:bg-amber-800/40",
      softGlassBg: "bg-amber-50/60 dark:bg-amber-800/60",
    },
    button: {
      solid: "bg-amber-500 hover:bg-amber-600",
      outline:
        "border-amber-500 text-amber-500 hover:bg-amber-50 hover:text-amber-700",
      glass:
        "bg-amber-100/40 dark:bg-amber-800/40 text-amber-500 hover:bg-amber-50 hover:text-amber-700",
      ghost: "text-amber-500 hover:bg-amber-50",
    },
    indicator: {
      active: "bg-amber-500",
      inactive: "bg-amber-200",
    },
  },
  emerald: {
    raw: "emerald",
    hex: "#10b981",
    brightHex: "#56d364",
    bg: "bg-emerald-500",
    hardGradientBg: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    softGradientBg:
      "bg-gradient-to-r from-gray-100/20 to-emerald-50 backdrop-blur-sm",
    verySoftGrandientBg:
      "bg-gradient-to-r from-transparent to-emerald-50/60 dark:from-transparent dark:to-emerald-900/60 backdrop-blur-sm",
    fadedBg: "bg-emerald-100 dark:bg-emerald-800/50",
    veryFadedBg: "bg-emerald-50 dark:bg-emerald-600/30",
    text: "text-emerald-500",
    ring: "ring-emerald-500",
    ringSoft: "ring-emerald-200",
    ringBright: "ring-emerald-300 dark:ring-emerald-700",
    ringOffset: "ring-offset-emerald-50 dark:ring-offset-emerald-900",
    fadedText: "text-emerald-500/50",
    veryFadedText: "text-emerald-200/30 dark:text-emerald-800/30",
    brightBorder: "border-emerald-200 dark:border-emerald-800",
    border: "border-emerald-400",
    primary: "bg-emerald-500",
    secondary: "bg-emerald-400",
    accent: "bg-emerald-300",
    hover: "hover:bg-emerald-100",
    background: "bg-emerald-50",
    card: {
      selected: {
        border: "border-emerald-400 dark:border-emerald-600",
        bg: "bg-emerald-50 dark:bg-emerald-800/50",
        glassBg: "bg-emerald-100/70 dark:bg-emerald-800/70",
      },
      glassBg: "bg-emerald-100/40 dark:bg-emerald-800/40",
      softGlassBg: "bg-emerald-50/60 dark:bg-emerald-800/60",
    },
    button: {
      solid: "bg-emerald-500 hover:bg-emerald-600",
      outline:
        "border-emerald-500 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700",
      glass:
        "bg-emerald-100/40 dark:bg-emerald-800/40 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700",
      ghost: "text-emerald-500 hover:bg-emerald-50",
    },
    indicator: {
      active: "bg-emerald-500",
      inactive: "bg-emerald-200",
    },
  },
  rose: {
    raw: "rose",
    hex: "#f43f5e",
    brightHex: "#fda4af",
    bg: "bg-rose-500",
    hardGradientBg: "bg-gradient-to-r from-rose-500 to-rose-600",
    softGradientBg:
      "bg-gradient-to-r from-gray-100/20to-rose-50 backdrop-blur-sm",
    verySoftGrandientBg:
      "bg-gradient-to-r from-transparent to-rose-50/60 dark:from-transparent dark:to-rose-900/60 backdrop-blur-sm",
    fadedBg: "bg-rose-100 dark:bg-rose-800/50",
    veryFadedBg: "bg-rose-50 dark:bg-rose-600/30",
    text: "text-rose-500",
    ring: "ring-rose-500",
    ringSoft: "ring-rose-200",
    ringBright: "ring-rose-300 dark:ring-rose-700",
    ringOffset: "ring-offset-rose-50 dark:ring-offset-rose-900",
    fadedText: "text-rose-500/50",
    veryFadedText: "text-rose-200/30 dark:text-rose-800/30",
    brightBorder: "border-rose-200 dark:border-rose-800",
    border: "border-rose-400",
    primary: "bg-rose-500",
    secondary: "bg-rose-400",
    accent: "bg-rose-300",
    hover: "hover:bg-rose-100",
    background: "bg-rose-50",
    card: {
      selected: {
        border: "border-rose-400 dark:border-rose-600",
        bg: "bg-rose-50 dark:bg-rose-800/50",
        glassBg: "bg-rose-100/70 dark:bg-rose-800/70",
      },
      glassBg: "bg-rose-100/40 dark:bg-rose-800/40",
      softGlassBg: "bg-rose-50/60 dark:bg-rose-800/60",
    },
    button: {
      solid: "bg-rose-500 hover:bg-rose-600",
      outline:
        "border-rose-500 text-rose-500 hover:bg-rose-50 hover:text-rose-700",
      glass:
        "bg-rose-100/40 dark:bg-rose-800/40 text-rose-500 hover:bg-rose-50 hover:text-rose-700",
      ghost: "text-rose-500 hover:bg-rose-50",
    },
    indicator: {
      active: "bg-rose-500",
      inactive: "bg-rose-200",
    },
  },
};

export const getThemeVariants = (color: LowerThemeColor): ThemeVariants => {
  if (color === "random") {
    const colors: BaseLoweredThemeColor[] = [
      "slate",
      "blue",
      "violet",
      "amber",
      "emerald",
      "rose",
    ];
    const randomIndex = Math.floor(Math.random() * colors.length);
    return themeVariants[colors[randomIndex]];
  }
  return themeVariants[color];
};

// Utility function to get text color classes
export const getTextColorClass = (color: BaseLoweredThemeColor): string => {
  return `text-${color}-500`;
};

// Utility function to get background color classes
export const getBgColorClass = (
  color: BaseLoweredThemeColor,
  shade: number = 500
): string => {
  return `bg-${color}-${shade}`;
};
