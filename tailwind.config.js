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
          DEFAULT: '#1a1a1a',
          light: '#3d3d3d',
          lighter: '#6b6b6b',
          lightest: '#9b9b9b'
        },
        paper: {
          DEFAULT: '#fafafa',
          light: '#ffffff',
          dark: '#f0f0f0',
          darker: '#e8e8e8'
        }
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem'
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        card: '0 2px 8px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)'
      }
    }
  },
  plugins: []
}
