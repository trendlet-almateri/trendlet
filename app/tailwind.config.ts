import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand / accent
        navy: {
          DEFAULT: "#2b3aa0",   // Optify accent
          deep: "#14205c",
        },
        accent: { DEFAULT: "#b4700a" }, // amber
        // Surfaces
        page:    "rgb(var(--color-page) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        sidebar: "#111418",
        "sidebar-hover": "#1c2028",
        // Text
        ink: {
          primary:   "rgb(var(--color-ink-primary)   / <alpha-value>)",
          secondary: "rgb(var(--color-ink-secondary) / <alpha-value>)",
          tertiary:  "rgb(var(--color-ink-tertiary)  / <alpha-value>)",
        },
        // Optify semantic tokens (used in arbitrary values but also handy as classes)
        line:        "#e7e5df",
        hover:       "#f9f8f4",
        "accent-soft": "#ecedf7",
        // Status palette
        status: {
          sourcing:  { bg: "#fdf3dd", fg: "#633806", border: "#EF9F27" },
          warehouse: { bg: "#E6F1FB", fg: "#0C447C", border: "#378ADD" },
          transit:   { bg: "#EEEDFE", fg: "#3C3489", border: "#7F77DD" },
          delivered: { bg: "#E1F5EE", fg: "#085041", border: "#1D9E75" },
          pending:   { bg: "#F1EFE8", fg: "#2C2C2A", border: "#888780" },
          danger:    { bg: "#fde3de", fg: "#791F1F", border: "#F09595" },
          success:   { bg: "#dcf1e3", fg: "#0F6E56", border: "#5DCAA5" },
        },
        // Semantic tokens matching Optify palette
        amber:  { DEFAULT: "#b4700a", bg: "#fdf3dd" },
        blue:   { DEFAULT: "#1d4ed8", bg: "#e2e8ff" },
        green:  { DEFAULT: "#0e7c4a", bg: "#dcf1e3" },
        rose:   { DEFAULT: "#b42318", bg: "#fde3de" },
        slate:  { DEFAULT: "#475569", bg: "#e9ecf1" },
        violet: { DEFAULT: "#6d28d9", bg: "#ece2fa" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      fontSize: {
        h1:    ["20px", { lineHeight: "28px", fontWeight: "500" }],
        h2:    ["16px", { lineHeight: "24px", fontWeight: "500" }],
        card:  ["13px", { lineHeight: "18px", fontWeight: "500" }],
        body:  ["13px", { lineHeight: "1.45", fontWeight: "400" }],
        label: ["11px", { lineHeight: "14px", fontWeight: "500" }],
        hint:  ["10px", { lineHeight: "14px", fontWeight: "400", letterSpacing: "0.4px" }],
      },
      borderRadius: {
        sm:      "4px",
        md:      "6px",
        DEFAULT: "8px",
        lg:      "10px",
        xl:      "12px",
      },
      boxShadow: {
        sm:      "0 1px 0 rgba(15,20,25,.04), 0 1px 2px rgba(15,20,25,.04)",
        md:      "0 1px 0 rgba(15,20,25,.04), 0 2px 6px rgba(15,20,25,.06), 0 12px 32px -16px rgba(15,20,25,.18)",
        modal:   "0 8px 24px rgba(0,0,0,0.12)",
        popover: "0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)",
        login:   "0 4px 16px rgba(0,0,0,0.04)",
      },
      borderColor: {
        hairline:        "rgba(15,20,25,0.10)",
        "hairline-strong": "rgba(15,20,25,0.18)",
      },
      animation: {
        "popover-in":  "popoverIn 0.15s cubic-bezier(.32,.72,.32,1) forwards",
        "popover-out": "popoverOut 0.12s cubic-bezier(.32,.72,.32,1) forwards",
        "drawer-in":   "drawerIn 0.28s cubic-bezier(.32,.72,.32,1) forwards",
        "drawer-out":  "drawerOut 0.22s cubic-bezier(.32,.72,.32,1) forwards",
        "backdrop-in": "backdropIn 0.25s ease forwards",
        "live-pulse":  "pulse 1.8s infinite",
        "alarm-pulse": "alarmPulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
