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
        'glass':       '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg':    '0 16px 48px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
