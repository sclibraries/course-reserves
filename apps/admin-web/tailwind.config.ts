import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
	"./index.html",
    "./pages/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./app/**/*.{ts,tsx,js,jsx}",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  prefix: "tw-",
  corePlugins: {
    preflight: false, // Bootstrap remains loaded until the last migration ticket.
  },
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        status: {
          draft: { DEFAULT: "hsl(var(--status-draft))", fg: "hsl(var(--status-draft-fg))" },
          submitted: { DEFAULT: "hsl(var(--status-submitted))", fg: "hsl(var(--status-submitted-fg))" },
          review: { DEFAULT: "hsl(var(--status-review))", fg: "hsl(var(--status-review-fg))" },
          partial: { DEFAULT: "hsl(var(--status-partial))", fg: "hsl(var(--status-partial-fg))" },
          complete: { DEFAULT: "hsl(var(--status-complete))", fg: "hsl(var(--status-complete-fg))" },
          canceled: { DEFAULT: "hsl(var(--status-canceled))", fg: "hsl(var(--status-canceled-fg))" },
        },
        priority: {
          normal: { DEFAULT: "hsl(var(--priority-normal))", fg: "hsl(var(--priority-normal-fg))" },
          high: { DEFAULT: "hsl(var(--priority-high))", fg: "hsl(var(--priority-high-fg))" },
          urgent: { DEFAULT: "hsl(var(--priority-urgent))", fg: "hsl(var(--priority-urgent-fg))" },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
