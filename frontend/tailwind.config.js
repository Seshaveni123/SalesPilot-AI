/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          900: '#312E81',
        },
        canvas: '#F8F9FB',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(9, 9, 11, 0.03), 0 1px 3px 0 rgba(9, 9, 11, 0.04)',
        elevated: '0 12px 32px -8px rgba(9, 9, 11, 0.10), 0 4px 12px -4px rgba(9, 9, 11, 0.05)',
        glow: '0 0 32px -4px rgba(79, 70, 229, 0.28)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.92)', opacity: '0.75' },
          '70%': { transform: 'scale(1.18)', opacity: '0' },
          '100%': { transform: 'scale(1.18)', opacity: '0' },
        },
        'eq-bar': {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        'eq-bar-1': 'eq-bar 0.9s ease-in-out infinite',
        'eq-bar-2': 'eq-bar 0.7s ease-in-out 0.15s infinite',
        'eq-bar-3': 'eq-bar 1.05s ease-in-out 0.3s infinite',
        'eq-bar-4': 'eq-bar 0.8s ease-in-out 0.45s infinite',
      },
    },
  },
  plugins: [],
};
