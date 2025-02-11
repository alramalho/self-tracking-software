export type BaseThemeColor =
  | "slate"
  | "blue"
  | "violet"
  | "amber"
  | "emerald"
  | "rose";

export type ThemeColor = BaseThemeColor | "random";

// All possible theme variants
export interface ThemeVariants {
  // Basic colors
  raw: ThemeColor; // Raw color name
  bg: string;
  fadedBg: string;
  darkText: string;
  text: string;
  border: string;
  fadedText: string;
  primary: string;
  secondary: string;
  accent: string;
  hover: string;
  background: string;
  cssVars: {
    appBackground: string;
  };

  // Component specific
  card: {
    selected: {
      border: string;
      bg: string;
      glassBg: string;
    };
    glassBg: string;
  };
  button: {
    solid: string;
    outline: string;
    ghost: string;
  };
  indicator: {
    active: string;
    inactive: string;
  };
}

// Force Tailwind to generate all theme classes
export const themeVariants: Record<BaseThemeColor, ThemeVariants> = {
  slate: {
    raw: "slate",
    bg: "bg-slate-500",
    fadedBg: "bg-slate-200/50",
    text: "text-slate-500",
    darkText: "text-slate-800",
    fadedText: "text-slate-300",
    border: "border-slate-400",
    primary: "bg-slate-500",
    secondary: "bg-slate-400",
    accent: "bg-slate-300",
    hover: "hover:bg-slate-100",
    background: "bg-slate-50",
    cssVars: {
      appBackground: "bg-gray-50",
    },
    card: {
      selected: {
        border: "border-slate-400",
        bg: "bg-slate-100",
        glassBg: "bg-slate-100/70",
      },
      glassBg: "bg-slate-100/40",
    },
    button: {
      solid: "bg-slate-500 hover:bg-slate-600",
      outline: "border-slate-500 text-slate-500 hover:bg-slate-50",
      ghost: "text-slate-500 hover:bg-slate-50",
    },
    indicator: {
      active: "bg-slate-500",
      inactive: "bg-slate-200",
    },
  },
  blue: {
    raw: "blue",
    bg: "bg-blue-500",
    fadedBg: "bg-blue-200/50",
    text: "text-blue-500",
    darkText: "text-blue-800",
    fadedText: "text-blue-300",
    border: "border-blue-400",
    primary: "bg-blue-500",
    secondary: "bg-blue-400",
    accent: "bg-blue-300",
    hover: "hover:bg-blue-100",
    background: "bg-blue-50",
    cssVars: {
      appBackground: "bg-gray-50",
    },
    card: {
      selected: {
        border: "border-blue-400",
        bg: "bg-blue-100",
        glassBg: "bg-blue-100/70",
      },
      glassBg: "bg-blue-100/40",
    },
    button: {
      solid: "bg-blue-500 hover:bg-blue-600",
      outline: "border-blue-500 text-blue-500 hover:bg-blue-50",
      ghost: "text-blue-500 hover:bg-blue-50",
    },
    indicator: {
      active: "bg-blue-500",
      inactive: "bg-blue-200",
    },
  },
  violet: {
    raw: "violet",
    bg: "bg-violet-500",
    fadedBg: "bg-violet-100",
    text: "text-violet-500",
    darkText: "text-violet-800",
    fadedText: "text-violet-300",
    border: "border-violet-500",
    primary: "bg-violet-500",
    secondary: "bg-violet-400",
    accent: "bg-violet-300",
    hover: "hover:bg-violet-100",
    background: "bg-violet-50",
    cssVars: {
      appBackground: "bg-gray-50",
    },
    card: {
      selected: {
        border: "border-violet-500",
        bg: "bg-violet-50",
        glassBg: "bg-violet-100/70",
      },
      glassBg: "bg-violet-100/40",
    },
    button: {
      solid: "bg-violet-500 hover:bg-violet-600",
      outline: "border-violet-500 text-violet-500 hover:bg-violet-50",
      ghost: "text-violet-500 hover:bg-violet-50",
    },
    indicator: {
      active: "bg-violet-500",
      inactive: "bg-violet-200",
    },
  },
  amber: {
    raw: "amber",
    bg: "bg-amber-500",
    fadedBg: "bg-amber-100",
    text: "text-amber-500",
    darkText: "text-amber-700",
    fadedText: "text-amber-300",
    border: "border-amber-400",
    primary: "bg-amber-500",
    secondary: "bg-amber-400",
    accent: "bg-amber-300",
    hover: "hover:bg-amber-100",
    background: "bg-amber-50",
    cssVars: {
      appBackground: "bg-gray-50",
    },
    card: {
      selected: {
        border: "border-amber-400",
        bg: "bg-amber-50",
        glassBg: "bg-amber-100/70",
      },
      glassBg: "bg-amber-100/40",
    },
    button: {
      solid: "bg-amber-500 hover:bg-amber-600",
      outline: "border-amber-500 text-amber-500 hover:bg-amber-50",
      ghost: "text-amber-500 hover:bg-amber-50",
    },
    indicator: {
      active: "bg-amber-500",
      inactive: "bg-amber-200",
    },
  },
  emerald: {
    raw: "emerald",
    bg: "bg-emerald-500",
    fadedBg: "bg-emerald-100",
    text: "text-emerald-500",
    darkText: "text-emerald-800",
    fadedText: "text-emerald-300",
    border: "border-emerald-400",
    primary: "bg-emerald-500",
    secondary: "bg-emerald-400",
    accent: "bg-emerald-300",
    hover: "hover:bg-emerald-100",
    background: "bg-emerald-50",
    cssVars: {
      appBackground: "bg-gray-50",
    },
    card: {
      selected: {
        border: "border-emerald-400",
        bg: "bg-emerald-50",
        glassBg: "bg-emerald-100/70",
      },
      glassBg: "bg-emerald-100/40",
    },
    button: {
      solid: "bg-emerald-500 hover:bg-emerald-600",
      outline: "border-emerald-500 text-emerald-500 hover:bg-emerald-50",
      ghost: "text-emerald-500 hover:bg-emerald-50",
    },
    indicator: {
      active: "bg-emerald-500",
      inactive: "bg-emerald-200",
    },
  },
  rose: {
    raw: "rose",
    bg: "bg-rose-500",
    fadedBg: "bg-rose-100",
    text: "text-rose-500",
    darkText: "text-rose-800",
    fadedText: "text-rose-300",
    border: "border-rose-400",
    primary: "bg-rose-500",
    secondary: "bg-rose-400",
    accent: "bg-rose-300",
    hover: "hover:bg-rose-100",
    background: "bg-rose-50",
    cssVars: {
      appBackground: "bg-gray-50",
    },
    card: {
      selected: {
        border: "border-rose-400",
        bg: "bg-rose-50",
        glassBg: "bg-rose-100/70",
      },
      glassBg: "bg-rose-100/40",
    },
    button: {
      solid: "bg-rose-500 hover:bg-rose-600",
      outline: "border-rose-500 text-rose-500 hover:bg-rose-50",
      ghost: "text-rose-500 hover:bg-rose-50",
    },
    indicator: {
      active: "bg-rose-500",
      inactive: "bg-rose-200",
    },
  },
};

export const getThemeVariants = (color: ThemeColor): ThemeVariants => {
  if (color === "random") {
    const colors: BaseThemeColor[] = [
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
export const getTextColorClass = (color: ThemeColor): string => {
  return `text-${color}-500`;
};

// Utility function to get background color classes
export const getBgColorClass = (
  color: ThemeColor,
  shade: number = 500
): string => {
  return `bg-${color}-${shade}`;
};
