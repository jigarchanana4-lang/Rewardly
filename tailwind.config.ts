import type { Config } from "tailwindcss";

/** Tokens live in globals.css as raw RGB channels, so every colour in the
 *  system accepts Tailwind's opacity modifier (e.g. bg-brand/20). */
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: c("brand"),
          ink: c("brand-ink"),
          soft: c("brand-soft"),
        },
        "on-brand": c("on-brand"),
        accent: {
          DEFAULT: c("accent"),
          ink: c("accent-ink"),
          soft: c("accent-soft"),
        },
        pink: {
          DEFAULT: c("pink"),
          soft: c("pink-soft"),
        },
        mango: {
          DEFAULT: c("mango"),
          soft: c("mango-soft"),
        },
        ink: c("ink"),
        "ink-2": c("ink-2"),
        line: c("line"),
        edge: c("edge"),
        surface: {
          DEFAULT: c("surface"),
          2: c("surface-2"),
        },
        bg: c("bg"),
        good: {
          DEFAULT: c("good"),
          soft: c("good-soft"),
        },
        warn: c("warn"),
        risk: {
          DEFAULT: c("risk"),
          soft: c("risk-soft"),
        },
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        card: "18px",
        lg: "20px",
        xl: "28px",
        "2xl": "34px",
        pill: "999px",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        pop: "3px 3px 0 0 rgb(var(--edge))",
        "pop-lg": "6px 6px 0 0 rgb(var(--edge))",
        "pop-line": "3px 3px 0 0 rgb(var(--line))",
      },
      animation: {
        rise: "rise .45s cubic-bezier(.2,.8,.2,1) backwards",
        float: "float-slow 6s ease-in-out infinite",
        ring: "pulse-ring 2s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
