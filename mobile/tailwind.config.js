/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // App is dark-only (no light theme), so a manually-toggleable mode avoids
  // NativeWind's web 'media' listener throwing when anything calls setColorScheme.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        zinc950: "#09090b",
        zinc900: "#18181b",
        zinc800: "#27272a",
        zinc700: "#3f3f46",
        zinc500: "#71717a",
        zinc400: "#a1a1aa",
        accentRed: "#dc2626",
        accentOrange: "#ea580c",
      },
    },
  },
  plugins: [],
};
