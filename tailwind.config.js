/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F9F6EE',
        cream: {
          50: '#FDFCF7',
          100: '#F9F6EE',
          200: '#F0ECE1',
          300: '#EDE8D5',
          400: '#DDD5BD',
        },
        card: '#FFFFFF',
        amber: {
          DEFAULT: '#F7CA58',
          hover: '#E6B840',
          light: '#FEF3D6',
          dark: '#B06000',
        },
        forest: {
          DEFAULT: '#084C46',
          dark: '#053531',
          light: '#106B63',
          surface: '#EBF4F3',
        },
        ink: {
          DEFAULT: '#1A202C',
          muted: '#4A5568',
          subtle: '#718096',
          light: '#A0AEC0',
        },
        status: {
          successBg: '#E6F4EA',
          successText: '#137333',
          warningBg: '#FEF3D6',
          warningText: '#B06000',
          dangerBg: '#FCE8E6',
          dangerText: '#C5221F',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(0, 0, 0, 0.04)',
        elevated: '0 10px 30px rgba(8, 76, 70, 0.08)',
        modal: '0 25px 50px -12px rgba(8, 76, 70, 0.25)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
