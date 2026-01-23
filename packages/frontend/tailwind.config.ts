import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        'primary-light': '#EEF2FF',
        'primary-dark': '#4338CA',
        success: '#10B981',
        'text-main': '#1E293B',
        'text-muted': '#64748B',
      },
      backgroundColor: {
        DEFAULT: '#F8FAFC',
        card: '#FFFFFF',
      },
      textColor: {
        DEFAULT: '#1E293B',
        muted: '#64748B',
      },
      borderColor: {
        DEFAULT: '#E2E8F0',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Inter"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      borderRadius: {
        standard: '12px',
        card: '20px',
      },
      maxWidth: {
        container: '600px',
      },
    },
  },
  plugins: [],
} satisfies Config
