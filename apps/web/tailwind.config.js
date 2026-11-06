/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          void: '#04070D',
          obsidian: '#080E17',
          surface: '#0E141D',
          card: '#141C2B',
          panel: '#1A2337',
          border: 'rgba(255, 255, 255, 0.08)',
          emerald: '#00F5A0',
          'emerald-glow': '#50FFAF',
          cyan: '#4CD6FB',
          amber: '#FFBA27',
          danger: '#EF4444',
          muted: '#94A3B8',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
