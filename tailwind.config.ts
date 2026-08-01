import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Legacy aliases → Dream Team FC palette
        pitch: "#1a5fff",
        ink: "#0c0e14",
        mist: "#e8eaef",
        brand: {
          void: "#050505",
          ink: "#0c0e14",
          panel: "#12141c",
          fog: "#e8eaef",
          mute: "#9aa3b5",
          line: "#2a2e3a",
          blue: "#1a5fff",
          cyan: "#00c2a8",
          green: "#00a651",
          gold: "#ffc20e",
          orange: "#f58220",
          red: "#d12027",
          magenta: "#ed1e79",
          violet: "#662d91"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"]
      },
      backgroundImage: {
        "brand-spectrum":
          "linear-gradient(90deg, #d12027 0%, #f58220 16%, #ffc20e 32%, #00a651 48%, #00c2a8 64%, #1a5fff 80%, #662d91 90%, #ed1e79 100%)",
        "brand-aurora":
          "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(26,95,255,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 10%, rgba(237,30,121,0.28), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,166,81,0.18), transparent 45%)"
      },
      boxShadow: {
        brand: "0 18px 50px rgba(5,5,5,0.35)"
      }
    }
  },
  plugins: []
};

export default config;
