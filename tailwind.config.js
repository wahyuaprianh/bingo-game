/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#f2b705',
          dark: '#c48f02',
        },
        coral: {
          DEFAULT: '#ff6b5b',
          dark: '#e14a3b',
        },
        teal: {
          DEFAULT: '#2ec4b6',
        },
        bg: {
          deep: '#0b0f19',
          panel: '#161f30',
          'panel-2': '#1b2537',
        },
        line: '#243049',
        ink: '#f8fafc',
        muted: '#94a3b8',
      },
      fontFamily: {
        display: ['var(--font-fredoka)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
      },
      animation: {
        glow: 'glow 1.5s infinite alternate',
        'pulse-dot': 'pulse-dot 1.2s infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 4px rgba(242, 183, 5, 0.2), inset 0 0 4px rgba(242, 183, 5, 0.2)' },
          '100%': { boxShadow: '0 0 16px rgba(242, 183, 5, 0.6), inset 0 0 8px rgba(242, 183, 5, 0.4)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
      },
      boxShadow: {
        panel: '0 12px 40px rgba(0, 0, 0, 0.25)',
        ball: '0 4px 10px rgba(0, 0, 0, 0.2)',
      }
    },
  },
  plugins: [],
}
