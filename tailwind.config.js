module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#fbbf24',
          dark: '#d97706',
        },
        rose: {
          DEFAULT: '#f43f5e',
          dark: '#be123c',
        },
        teal: {
          DEFAULT: '#14b8a6',
          dark: '#0f766e',
        },
        indigo: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
        },
        bg: {
          deep: '#090a0f',
          panel: '#131520',
          'panel-2': '#181a28',
        },
        line: '#212330',
        ink: '#f4f4f5',
        muted: '#71717a',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
      },
      animation: {
        glow: 'glow 1.5s infinite alternate',
        'pulse-dot': 'pulse-dot 1.2s infinite',
        shimmer: 'shimmer 2s infinite linear',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 4px rgba(251, 191, 36, 0.2), inset 0 0 4px rgba(251, 191, 36, 0.2)' },
          '100%': { boxShadow: '0 0 16px rgba(251, 191, 36, 0.6), inset 0 0 8px rgba(251, 191, 36, 0.4)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
      },
      boxShadow: {
        panel: '0 12px 40px rgba(0, 0, 0, 0.4)',
        ball: '0 4px 10px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
