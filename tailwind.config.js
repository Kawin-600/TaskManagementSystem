/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Prompt', 'Sarabun', 'system-ui', 'sans-serif'],
        body: ['Sarabun', 'Prompt', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
