import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rush: {
          'bg-primary': '#0A0A0F',
          'bg-secondary': '#12121A',
          'bg-tertiary': '#1A1A2E',
          'accent-gold': '#E8C547',
          'accent-teal': '#4ECDC4',
          'accent-danger': '#FF6B6B',
          'accent-success': '#51CF66',
          'text-primary': '#F0F0F0',
          'text-secondary': '#8B8B9E',
          'text-muted': '#5A5A6E',
          'border': '#2A2A3E',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
