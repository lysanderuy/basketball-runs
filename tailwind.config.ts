import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // OpenRun Design Tokens
        bg: "#0e0f0c",
        "bg-raised": "#161710",
        "bg-surface": "#1e2019",
        "bg-hover": "#252720",

        accent: "#c8f135",
        "accent-dim": "#a0c228",
        "accent-glow": "rgba(200, 241, 53, 0.15)",

        "text-primary": "#f0f0e8",
        "text-secondary": "#8a8c7a",
        "text-muted": "#4a4c3e",

        border: "#2a2c22",
        "border-accent": "rgba(200, 241, 53, 0.3)",

        // Team colors
        "team-a": "#ffffff",
        "team-b": "#ffffff",

        // Utility
        danger: "#ff4040",
        "danger-light": "rgba(255, 64, 64, 0.08)",
      },
      fontFamily: {
        display: ["Barlow Condensed", "sans-serif"],
        body: ["Barlow", "sans-serif"],
      },
      fontSize: {
        "display-sm": ["11px", { lineHeight: "1", letterSpacing: "0.14em" }],
        "display-md": ["12px", { lineHeight: "1", letterSpacing: "0.14em" }],
        "display-lg": ["14px", { lineHeight: "1", letterSpacing: "0.1em" }],
        "display-xl": ["16px", { lineHeight: "1", letterSpacing: "0.1em" }],
        "display-2xl": ["20px", { lineHeight: "1", letterSpacing: "0.02em" }],
        "display-3xl": ["38px", { lineHeight: "1", letterSpacing: "0.02em" }],
        "display-4xl": ["52px", { lineHeight: "0.9", letterSpacing: "-0.01em" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
      height: {
        "13": "3.25rem",
        "toggle": "26px",
        "toggle-knob": "18px",
      },
      width: {
        "toggle": "44px",
        "toggle-knob": "18px",
      },
      translate: {
        "toggle-on": "18px",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "live-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.7)" },
        },
        "pulse-warn": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "join-flash": {
          "0%": { borderColor: "#c8f135", background: "rgba(200, 241, 53, 0.1)" },
          "100%": { borderColor: "#2a2c22", background: "#1e2019" },
        },
        "score-flash": {
          "0%": { background: "rgba(200, 241, 53, 0.25)" },
          "100%": { background: "#1e2019" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out both",
        "live-pulse": "live-pulse 1.8s ease-in-out infinite",
        "pulse-warn": "pulse-warn 0.8s ease-in-out infinite",
        "join-flash": "join-flash 0.6s ease-out",
        "score-flash": "score-flash 0.5s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        shake: "shake 0.4s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
