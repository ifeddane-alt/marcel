/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                fontFamily: {
                        heading: ["'Outfit'", "sans-serif"],
                        "mono-data": ["'JetBrains Mono'", "monospace"],
                        mono: ["'JetBrains Mono'", "monospace"],
                        sans: ["'Plus Jakarta Sans'", "-apple-system", "sans-serif"],
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        'm-ink': 'rgb(var(--m-ink) / <alpha-value>)',
                        'm-ink-soft': 'rgb(var(--m-ink-soft) / <alpha-value>)',
                        'm-muted': 'rgb(var(--m-muted) / <alpha-value>)',
                        'm-muted-2': 'rgb(var(--m-muted-2) / <alpha-value>)',
                        'm-border': 'rgb(var(--m-border) / <alpha-value>)',
                        'm-border-strong': 'rgb(var(--m-border-strong) / <alpha-value>)',
                        'm-border-soft': 'rgb(var(--m-border-soft) / <alpha-value>)',
                        'm-border-lav': 'rgb(var(--m-border-lav) / <alpha-value>)',
                        'm-bg': 'rgb(var(--m-bg) / <alpha-value>)',
                        'm-surface': 'rgb(var(--m-surface) / <alpha-value>)',
                        'm-lilac': 'rgb(var(--m-lilac) / <alpha-value>)',
                        'm-blue-soft': 'rgb(var(--m-blue-soft) / <alpha-value>)',
                        'm-blue': 'rgb(var(--m-blue) / <alpha-value>)',
                        'm-blue-dark': 'rgb(var(--m-blue-dark) / <alpha-value>)',
                        'm-primary': 'rgb(var(--m-primary) / <alpha-value>)',
                        'm-primary-dark': 'rgb(var(--m-primary-dark) / <alpha-value>)',
                        'm-primary-deep': 'rgb(var(--m-primary-deep) / <alpha-value>)',
                        'm-red': 'rgb(var(--m-red) / <alpha-value>)',
                        'm-red-soft': 'rgb(var(--m-red-soft) / <alpha-value>)',
                        'm-green': 'rgb(var(--m-green) / <alpha-value>)',
                        'm-green-soft': 'rgb(var(--m-green-soft) / <alpha-value>)',
                        'm-amber': 'rgb(var(--m-amber) / <alpha-value>)',
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        }
                },
                keyframes: {
                        'accordion-down': {
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out'
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
