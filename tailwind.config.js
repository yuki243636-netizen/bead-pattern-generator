/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace']
      },
      colors: {
        ink: {
          DEFAULT: '#1A1A2E',   // soft charcoal (was #1a1a1a)
          light: '#3D3D5C',
          lighter: '#636E72',   // medium gray (was #6b6b6b)
          lightest: '#9FA3A7'   // lighter gray (was #9b9b9b)
        },
        paper: {
          DEFAULT: '#F0F4F4',   // cool off-white (was #fafafa)
          light: '#FFFFFF',     // pure white card (was #ffffff)
          dark: '#E8ECEC',      // subtle surface (was #f0f0f0)
          darker: '#DDE3E3'     // very subtle border (was #e8e8e8)
        },
        // Accent colors — soft, desaturated pastels
        accent: {
          teal: '#5B7C8B',      // muted teal — primary actions
          tealDark: '#4A6573',  // darker teal for hover
          pink: '#E8B4B8',      // soft pink — highlights
          amber: '#E8A87C',     // warm amber — warnings
          lavender: '#C9B8D9',  // soft lavender
          mint: '#A8D5BA',      // soft mint
          cream: '#F4E4BC',     // warm cream
        }
      },
      borderRadius: {
        xl: '1rem',       // 16px (was 0.875rem)
        '2xl': '1.25rem', // 20px
        '3xl': '1.75rem', // 28px
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.04)',
        card: '0 4px 20px rgba(0,0,0,0.06)',
        elevated: '0 8px 32px rgba(0,0,0,0.08)',
        inner: 'inset 0 1px 3px rgba(0,0,0,0.04)',
      }
    }
  },
  plugins: []
}
