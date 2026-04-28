import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          brown: "#31261D",
          green: "#878800",
          stone: "#ecdcc8",
          "stone-light": "#f7f0e7",
          "green-dark": "#5a5b00",
          "green-light": "#a8ab00",
          "brown-light": "#4a3c30",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
