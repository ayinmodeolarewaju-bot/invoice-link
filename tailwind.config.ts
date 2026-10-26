import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { ink: "#0B0D12", paper: "#F7F5F0", mint: "#2BD4A4", signal: "#FFB547", err: "#FF5A5F", violet: "#6E5BFF" },
    fontFamily: { sans: ["Inter Tight", "Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
    borderRadius: { card: "16px", field: "10px" },
    boxShadow: { card: "0 20px 60px -20px rgba(11,13,18,.25)", violet: "0 12px 30px -10px rgba(110,91,255,.6)" },
  } },
} satisfies Config;
