/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'slide-in-from-top-full': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom-full': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-out-to-right-full': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-out-80': {
          '0%': { opacity: 1 },
          '100%': { opacity: 0.2 },
        },
      },
      animation: {
        'in': 'slide-in-from-top-full 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        'out': 'fade-out-80 150ms ease-in',
      },
    },
  },
  plugins: [],
};