import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['data/palettes/bead-palettes.json'],
      manifest: {
        name: '甘薯么拼豆',
        short_name: '甘薯么拼豆',
        description: '将任意图片转换为拼豆图纸，自动匹配颜色、统计数量、推荐缺色替换。',
        theme_color: '#E091A6',
        background_color: '#FAF5F7',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 不缓存 PNG 图标文件，确保图标更新能立即生效
        globIgnores: ['**/icon-*.png', '**/favicon.png', '**/apple-touch-icon.png'],
      }
    })
  ]
})
