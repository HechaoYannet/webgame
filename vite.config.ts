import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// CLAUDE.md §2: base '/webgame/'（仓库名，首尾斜杠都要），HashRouter 路由不经服务器
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/webgame/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 压低内联阈值，避免 PDF/音频等大文件被 base64 内联进 JS
    assetsInlineLimit: 4096,
  },
})
