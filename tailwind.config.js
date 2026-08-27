/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}', './demos/**/*.html'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#090A0E',
          surface: '#11131A',
          card: '#161922',
          border: 'rgba(255, 255, 255, 0.07)',
          borderHover: 'rgba(255, 255, 255, 0.16)',
        },
        light: {
          bg: '#F8F9FA',
          surface: '#FFFFFF',
          card: '#F1F3F7',
          border: '#E2E8F0',
          borderHover: '#CBD5E1',
        },
        accent: {
          roman: '#EF4444',
          manga: '#6366F1',
          bd: '#10B981',
          comics: '#F59E0B',
        }
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      }
    }
  },
  plugins: []
}