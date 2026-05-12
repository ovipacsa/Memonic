import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cosmic tokens
        midnight: "var(--midnight)",
        "midnight-deep": "var(--midnight-deep)",
        "midnight-soft": "var(--midnight-soft)",
        magenta: "var(--magenta)",
        cyan: "var(--cyan)",
        yellow: "var(--yellow)",
        purple: "var(--purple)",
        star: "var(--star)",
        "star-soft": "var(--star-soft)",
        mute: "var(--mute)",
        rule: "var(--rule)",

        // Legacy aliases — point at cosmic equivalents so existing classNames still resolve
        paper: "var(--paper)",
        "paper-deep": "var(--paper-deep)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        oxblood: "var(--oxblood)",
        "oxblood-ink": "var(--oxblood-ink)",
        teal: "var(--teal)",
        ochre: "var(--ochre)",
        "accent-bg": "var(--accent-bg)"
      },
      fontFamily: {
        display: ["var(--font-monoton)", "Impact", "sans-serif"],
        chrome: ["var(--font-audiowide)", "var(--font-monoton)", "sans-serif"],
        terminal: ["var(--font-vt323)", "ui-monospace", "monospace"],
        mono: ["var(--font-space-mono)", "ui-monospace", "monospace"],
        // Legacy aliases
        serif: ["var(--font-monoton)", "Impact", "sans-serif"],
        sans: ["var(--font-vt323)", "ui-monospace", "monospace"]
      },
      letterSpacing: {
        masthead: "0.04em",
        rail: "0.18em",
        meta: "0.22em"
      }
    }
  },
  plugins: []
};

export default config;
