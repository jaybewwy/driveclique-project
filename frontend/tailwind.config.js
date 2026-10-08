/*
  Colours that change with the theme read their RGB channels from a CSS
  variable defined in src/index.css, so one class resolves per theme and
  opacity modifiers (bg-zinc-900/50) keep working.
*/
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const shades = (prefix, list) =>
  Object.fromEntries(list.map((shade) => [shade, themed(`${prefix}-${shade}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        /*
          The neutrals follow the theme. In the dark theme they are Tailwind's
          own values; the light theme swaps them (see index.css), which is why
          the app's existing zinc/white/black classes work in both.
        */
        zinc:  shades('zinc', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        white: themed('white'),
        black: themed('black'),
        /* The same in both themes: scrims, shadows, anything over a photo */
        'true-white': '#ffffff',
        'true-black': '#000000',

        /* Semantic tokens used by GooeyDock, Button, and Tooltip */
        background:  "rgb(var(--background) / <alpha-value>)",
        foreground:  "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT:    "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT:    "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT:    "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        ring:   "rgb(var(--ring) / <alpha-value>)",
        input:  "rgb(var(--input) / <alpha-value>)",
        secondary: {
          DEFAULT:    "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT:    "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT:    "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT:    "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
      },
      /*
        Coloured text. The pale shades the app uses on dark surfaces
        (text-red-400, text-green-400…) are unreadable on white, so as text
        colours only they follow the theme. bg-red-400, border-red-400 etc.
        stay Tailwind's.
      */
      textColor: {
        red:     shades('text-red', [300, 400, 500]),
        orange:  shades('text-orange', [300, 400]),
        amber:   shades('text-amber', [300, 400, 500]),
        yellow:  shades('text-yellow', [400]),
        green:   shades('text-green', [300, 400, 500]),
        emerald: shades('text-emerald', [400]),
        sky:     shades('text-sky', [400]),
        blue:    shades('text-blue', [400]),
        purple:  shades('text-purple', [400]),
      },
      /*
        Tinted panels. bg-red-900/30 and friends are a dark wash behind
        status text; the light theme needs a pale wash instead.
      */
      backgroundColor: {
        red:    { 900: themed('tint-red') },
        amber:  { 900: themed('tint-amber') },
        yellow: { 900: themed('tint-yellow') },
        green:  { 900: themed('tint-green') },
        sky:    { 900: themed('tint-sky') },
        blue:   { 900: themed('tint-blue') },
      },
      animation: {
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'fade-slide-up':  'fade-slide-up 0.3s ease-out forwards',
        'shimmer':        'shimmer 1.5s ease-in-out infinite',
        'float':          'float 3s ease-in-out infinite',
        'glow-pulse':     'glow-pulse 2s ease-in-out infinite',
        'spin-slow':      'spin-slow 8s linear infinite',
      },
      boxShadow: {
        'glow-red':    '0 0 20px rgba(220, 38, 38, 0.3)',
        'glow-red-lg': '0 0 40px rgba(220, 38, 38, 0.4)',
        'glass':       '0 8px 32px rgb(0 0 0 / var(--shadow-glass))',
        'glass-lg':    '0 16px 48px rgb(0 0 0 / var(--shadow-glass-lg))',
      },
    },
  },
  plugins: [],
}
