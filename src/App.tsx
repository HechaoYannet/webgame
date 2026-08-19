/**
 * src/App.tsx — 应用根组件（frontend-phone-shell 自有）。
 *
 * 职责：
 *  1) ImageViewerProvider：图片放大查看器（朋友圈/网页配图放大看"新希望"字样）。
 *  2) AppRouter：HashRouter（createHashRouter + RouterProvider）。
 *     engine 初始化 / 导航绑定 / 事件桥接都由 AppRouter 内的 RootLayout 在
 *     router context 内完成（initEngine + bindNavigate + wireShellToEngine）。
 *
 * 删掉 Vite 默认 App 内容（hero/计数器等）。
 */
import { ImageViewerProvider } from '@/ui/ImageViewer'
import { AppRouter } from '@/apps/PhoneShell/AppRouter'

function App() {
  return (
    <ImageViewerProvider>
      <AppRouter />
    </ImageViewerProvider>
  )
}

export default App
