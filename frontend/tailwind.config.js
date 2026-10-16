/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lab: {
          dark: '#0b0e14',
          surface: '#131722',
          card: '#1a202c',
          border: '#2a3346',
          lime: '#39ff14',
          'lime-dim': '#10b981',
          purple: '#a855f7',
          pink: '#ec4899',
          yellow: '#facc15',
          cyan: '#06b6d4',
          text: '#f8fafc',
          muted: '#94a3b8',
        },
        wa: {
          green: '#00a884',
          'green-dark': '#008069',
          'green-light': '#25D366',
          'bubble-out': '#14382d',
          'bubble-in': '#1e2430',
          bg: '#0d1117',
          gray: '#8696a0',
          border: '#242b3d',
        },
        ios: {
          blue: '#007AFF',
          green: '#34C759',
          red: '#FF3B30',
          yellow: '#FFCC00',
          gray: '#1e2430',
          card: '#161922',
          text: '#f8fafc',
          subtext: '#94a3b8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'lab-glow': '0 0 20px -3px rgba(57, 255, 20, 0.25)',
        'lab-purple': '0 0 20px -3px rgba(168, 85, 247, 0.25)',
        'lab-card': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'ios-nav': '0 1px 0 rgba(255, 255, 255, 0.08)',
        'ios-tab': '0 -1px 0 rgba(255, 255, 255, 0.08)',
        'ios-bubble': '0 1px 2px rgba(0, 0, 0, 0.3)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px #39ff14)' },
          '50%': { opacity: '0.7', filter: 'drop-shadow(0 0 2px #39ff14)' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
