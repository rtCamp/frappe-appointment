/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        // Espresso tokens, defined inside .espresso (src/styles/espresso.css).
        surface: {
          base: "var(--surface-base)",
          sidebar: "var(--surface-sidebar)",
          "elevation-2": "var(--surface-elevation-2)",
          "elevation-3": "var(--surface-elevation-3)",
          "gray-1": "var(--surface-gray-1)",
          "gray-2": "var(--surface-gray-2)",
          "gray-3": "var(--surface-gray-3)",
          "gray-4": "var(--surface-gray-4)",
          "gray-9": "var(--surface-gray-9)",
          "gray-10": "var(--surface-gray-10)",
          "red-2": "var(--surface-red-2)",
          "green-2": "var(--surface-green-2)",
          "amber-2": "var(--surface-amber-2)",
          "blue-2": "var(--surface-blue-2)",
        },
        ink: {
          base: "var(--ink-base)",
          "gray-4": "var(--ink-gray-4)",
          "gray-5": "var(--ink-gray-5)",
          "gray-6": "var(--ink-gray-6)",
          "gray-7": "var(--ink-gray-7)",
          "gray-8": "var(--ink-gray-8)",
          "gray-9": "var(--ink-gray-9)",
          "red-7": "var(--ink-red-7)",
          "green-7": "var(--ink-green-7)",
          "amber-7": "var(--ink-amber-7)",
          "blue-5": "var(--ink-blue-5)",
          "blue-7": "var(--ink-blue-7)",
          "blue-link": "var(--ink-blue-link)",
        },
        outline: {
          "gray-1": "var(--outline-gray-1)",
          "gray-2": "var(--outline-gray-2)",
          "gray-3": "var(--outline-gray-3)",
          "gray-4": "var(--outline-gray-4)",
          "gray-5": "var(--outline-gray-5)",
        },
      },
      fontFamily: {
        espresso: ["InterVar", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Espresso type scale, prefixed so it doesn't clash with Tailwind's text-sm/base/lg.
      fontSize: {
        "es-xs": ["12px", { lineHeight: "1.15", letterSpacing: "0.02em", fontWeight: "420" }],
        "es-sm": ["13px", { lineHeight: "1.15", letterSpacing: "0.02em", fontWeight: "420" }],
        "es-base": ["14px", { lineHeight: "1.15", letterSpacing: "0.02em", fontWeight: "420" }],
        "es-lg": ["16px", { lineHeight: "1.15", letterSpacing: "0.015em", fontWeight: "420" }],
        "es-p-sm": ["13px", { lineHeight: "1.5", letterSpacing: "0.015em", fontWeight: "420" }],
        "es-p-base": ["14px", { lineHeight: "1.5", letterSpacing: "0.02em", fontWeight: "420" }],
        "es-title": ["24px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
      },
      boxShadow: {
        "es-sm": "var(--elevation-sm)",
        "es-2xl": "var(--elevation-2xl)",
        "es-focus": "var(--focus-ring)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
