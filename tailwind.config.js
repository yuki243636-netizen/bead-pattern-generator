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
          DEFAULT: '#2B1E26',   // 深褐紫 — 偏暖的深色文字
          light: '#4D3A4C',
          lighter: '#8A7A82',   // 暖灰
          lightest: '#B5A8AE'   // 浅暖灰
        },
        paper: {
          DEFAULT: '#FAF5F7',   // 极浅粉白 — 温暖背景
          light: '#FFFFFF',     // 纯白卡片
          dark: '#F5EDF0',      // 浅粉灰
          darker: '#E8DDE2'     // 粉色边框
        },
        // Accent colors — 粉色系
        accent: {
          teal: '#E091A6',      // 柔玫瑰粉 — 主操作色（保留 teal 键名避免大面积改代码）
          tealDark: '#D17E96',  // 深玫瑰粉 — hover
          pink: '#E8B4B8',      // 浅粉 — 高亮
          amber: '#E8A87C',     // 暖橙 — 警告
          lavender: '#C9B8D9',  // 柔紫
          mint: '#A8D5BA',      // 柔薄荷
          cream: '#F4E4BC',     // 暖奶油
        }
      },
      borderRadius: {
        xl: '1rem',       // 16px
        '2xl': '1.25rem', // 20px
        '3xl': '1.75rem', // 28px
      },
      boxShadow: {
        soft: '0 2px 8px rgba(180, 100, 130, 0.05)',
        card: '0 4px 20px rgba(180, 100, 130, 0.08)',
        elevated: '0 8px 32px rgba(180, 100, 130, 0.10)',
        inner: 'inset 0 1px 3px rgba(180, 100, 130, 0.04)',
      }
    }
  },
  plugins: []
}
