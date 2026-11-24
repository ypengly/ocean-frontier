/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: { 950: '#030b17', 900: '#061426', 800: '#0a2036', 700: '#103049' },
        tide: { 300: '#7ee8f5', 400: '#34d6ea', 500: '#14b8d4', 600: '#0e93ad' },
        lagoon: { 400: '#2dd4bf', 500: '#14b8a6' },
        warn: { 400: '#fbbf24', 500: '#f97316' },
        danger: { 500: '#f43f5e' },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
