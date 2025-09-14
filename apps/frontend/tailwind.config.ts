import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      boxShadow: {
        "md-top":
          "0 -6px 12px -3px rgb(0 0 0 / 0.05), 0 4px 6px -2px rgb(0 0 0 / 0.03)",
        "inner-custom": "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
          "6": "hsl(var(--chart-6))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        shine: {
          "0%": { "background-position": "100%" },
          "100%": { "background-position": "-100%" },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "collapsible-down": {
          from: {
            height: "0",
            opacity: "0",
          },
          to: {
            height: "var(--radix-collapsible-content-height)",
            opacity: "1",
          },
        },
        "collapsible-up": {
          from: {
            height: "var(--radix-collapsible-content-height)",
            opacity: "1",
          },
          to: {
            height: "0",
            opacity: "0",
          },
        },
        wiggle: {
          "0%, 15%, 100%": {
            transform: "rotate(0deg)",
            transformOrigin: "bottom right",
          },
          "20%": {
            transform: "rotate(-10deg)",
            transformOrigin: "bottom right",
          },
          "25%": {
            transform: "rotate(10deg)",
            transformOrigin: "bottom right",
          },
          "30%": {
            transform: "rotate(-10deg)",
            transformOrigin: "bottom right",
          },
          "35%": {
            transform: "rotate(10deg)",
            transformOrigin: "bottom right",
          },
          "40%, 100%": {
            transform: "rotate(0deg)",
            transformOrigin: "bottom right",
          },
        },
        float: {
          "0%, 100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "20%": {
            transform: "translate(15px, -10px) scale(1.02)",
          },
          "40%": {
            transform: "translate(-8px, -20px) scale(0.98)",
          },
          "60%": {
            transform: "translate(-12px, -5px) scale(1.01)",
          },
          "80%": {
            transform: "translate(10px, -15px) scale(0.99)",
          },
        },
        "float-reverse": {
          "0%, 100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "20%": {
            transform: "translate(-15px, -10px) scale(0.98)",
          },
          "40%": {
            transform: "translate(8px, -20px) scale(1.02)",
          },
          "60%": {
            transform: "translate(12px, -5px) scale(0.99)",
          },
          "80%": {
            transform: "translate(-10px, -15px) scale(1.01)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.3s ease-out",
        "collapsible-up": "collapsible-up 0.3s ease-out",
        wiggle: "wiggle 3s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        shine: "shine 5s linear infinite",
        "float-slow": "float 25s ease-in-out infinite",
        "float-medium": "float-reverse 18s ease-in-out infinite",
        "float-fast": "float 22s ease-in-out infinite 0.5s",
      },
    },
    fontFamily: {
      cursive: ["Caveat", "cursive"],
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
