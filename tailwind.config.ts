import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        coursera: {
          blue: '#0056D2',
          darkblue: '#004BB5',
        }
      }
    },
  },
  plugins: [],
} satisfies Config;

