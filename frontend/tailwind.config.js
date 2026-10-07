/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        surface: {
          DEFAULT: '#12121a',
          secondary: '#181824',
          hover: '#202030',
        },
        border: {
          DEFAULT: '#26263b',
          subtle: '#1c1c2b',
        },
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#818cf8',
          glow: 'rgba(99, 102, 241, 0.25)',
        },
        accent: {
          DEFAULT: '#00d4a7',
          hover: '#00b890',
        },
        dark: {
          900: '#07070b',
          800: '#0e0e16',
          700: '#161622',
          600: '#232336',
          500: '#3a3a54',
          400: '#6d6d8f',
          300: '#9e9ebc',
          200: '#cdcdde',
          100: '#ebebf4',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 35px -5px rgba(99, 102, 241, 0.3)',
        'glow-accent': '0 0 35px -5px rgba(0, 212, 167, 0.25)',
        'card': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
