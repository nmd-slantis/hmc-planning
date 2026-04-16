import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // /slantis brand colors
      colors: {
        slantis: {
          orange: "#FF7700",   // 🧡 Primary / hero
          yellow: "#FFE900",   // 💛 VIZ lane
          sky: "#5BD9D6",      // 💙 ARCH lane
          green: "#44C15D",    // 💚 TRNG lane
          pink: "#F479D1",     // 💗 BIM lane
          purple: "#552497",   // 💜 General / OTHER
          black: "#202022",    // 🖤 PM lane
        },
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
