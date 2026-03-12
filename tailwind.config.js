/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1a2744',
          light: '#243559',
          dark: '#111c33',
        },
        'warm-white': '#f8f6f1',
        orange: {
          DEFAULT: '#e85d26',
          light: '#f07040',
          dark: '#c94d1e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
