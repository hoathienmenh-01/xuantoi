import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f9f6ee',
          100: '#efe7d2',
          300: '#bfa66a',
          500: '#8a6e34',
          700: '#3a2f1c',
          900: '#1b150a',
        },
      },
      fontFamily: {
        co: ['"Noto Serif SC"', '"Noto Serif"', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
