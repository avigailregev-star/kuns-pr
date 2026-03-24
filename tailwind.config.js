/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    fontFamily: {
      sans: ['Rubik', 'Arial', 'sans-serif'],
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          50: '#F5F3FF',
          100: '#EDE9FE',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          900: '#4C1D95',
        },
        accent: {
          DEFAULT: '#2563EB',
          400: '#60A5FA',
          600: '#1D4ED8',
        },
        dark: {
          900: '#0F0A1E',
          800: '#1A1030',
          700: '#251845',
          600: '#2D1F55',
        },
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0F0A1E 0%, #1A1030 50%, #0F172A 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(37,99,235,0.10) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
