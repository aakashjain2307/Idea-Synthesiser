import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        moss: "#2f6f5e",
        amberline: "#c47a21",
        lake: "#2d6cdf",
        plum: "#6d4aa2"
      },
      boxShadow: {
        panel: "0 18px 50px rgba(23, 32, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
