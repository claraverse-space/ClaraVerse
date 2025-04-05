/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sakura: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'inherit',
            a: {
              color: 'inherit',
              textDecoration: 'underline',
              '&:hover': {
                color: 'inherit',
                opacity: 0.8,
              },
            },
            code: {
              color: 'inherit',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
      keyframes: {
        'fade-out': {
          '0%': { opacity: '1' },
          '75%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        glow: {
          '0%, 100%': { 
            boxShadow: '0 0 10px rgba(244, 114, 182, 0.5), 0 0 20px rgba(244, 114, 182, 0.3), 0 0 30px rgba(244, 114, 182, 0.2)'
          },
          '50%': { 
            boxShadow: '0 0 15px rgba(244, 114, 182, 0.7), 0 0 25px rgba(244, 114, 182, 0.5), 0 0 35px rgba(244, 114, 182, 0.3)'
          }
        }
      },
      animation: {
        'fade-out': 'fade-out 3s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite'
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};