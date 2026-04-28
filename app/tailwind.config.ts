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
        // Brand
        navy: {
          DEFAULT: "#0C447C",
          deep: "#042C53",
        },
        accent: { DEFAULT: "#E24B4A" },
        // Surfaces
        page: "#F5F5F7",
        surface: "#FFFFFF",
        sidebar: "#1A1A1A",
        "sidebar-hover": "#2A2A2A",
        // Text
        ink: {
          primary: "#171717",
          secondary: "#525252",
          tertiary: "#737373",
        },
        // Status palette (light surface / dark text / mid border)
        status: {
          sourcing: { bg: "#FAEEDA", fg: "#633806", border: "#EF9F27" },
          warehouse: { bg: "#E6F1FB", fg: "#0C447C", border: "#378ADD" },
          transit: { bg: "#EEEDFE", fg: "#3C3489", border: "#7F77DD" },
          delivered: { bg: "#E1F5EE", fg: "#085041", border: "#1D9E75" },
          pending: { bg: "#F1EFE8", fg: "#2C2C2A", border: "#888780" },
          danger: { bg: "#FCEBEB", fg: "#791F1F", border: "#F09595" },
          success: { bg: "#E1F5EE", fg: "#0F6E56", border: "#5DCAA5" },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontWeight: {
        // Per spec: only 400 and 500 are used.
        normal: "400",
        medium: "500",
      },
      fontSize: {
        // Spec scale
        h1: ["20px", { lineHeight: "28px", fontWeight: "500" }],
        h2: ["16px", { lineHeight: "24px", fontWeight: "500" }],
        card: ["13px", { lineHeight: "18px", fontWeight: "500" }],
        body: ["13px", { lineHeight: "18px", fontWeight: "400" }],
        label: ["11px", { lineHeight: "14px", fontWeight: "500" }],
        hint: ["10px", { lineHeight: "14px", fontWeight: "400", letterSpacing: "0.4px" }],
      },
      borderRadius: {
        sm: "4px",
        md: "5px",
        DEFAULT: "6px",
        lg: "8px",
        xl: "12px",
      },
      boxShadow: {
        // Restrained — only modals, login, notifications
        modal: "0 8px 24px rgba(0,0,0,0.12)",
        popover: "0 8px 24px rgba(0,0,0,0.08)",
        login: "0 4px 16px rgba(0,0,0,0.04)",
      },
      borderColor: {
        hairline: "rgba(0,0,0,0.08)",
        "hairline-strong": "rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
