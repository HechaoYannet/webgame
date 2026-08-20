/**
 * src/App.tsx — 应用根组件（frontend-phone-shell 自有）。
 *
 * 职责：
 *  1) ImageViewerProvider：图片放大查看器（朋友圈/网页配图放大看"新希望"字样）。
 *  2) AppRouter：HashRouter（createHashRouter + RouterProvider）。
 *     engine 初始化 / 导航绑定 / 事件桥接都由 AppRouter 内的 RootLayout 在
 *     router context 内完成（initEngine + bindNavigate + wireShellToEngine）。
 *  3) IntroScreen：游戏入口主站（宣传页 + 电影字幕前情提要）。
 *
 * 触发逻辑（确定性，依据持久化在 localStorage 的存档，不再用 sessionStorage）：
 *   - finished === false 且 solvedPuzzleIds 为空 → 全新开局，显示入口。
 *   - 有已解谜题 或 已达结局 → 视为有在玩/已通关，直接进游戏不打断。
 *   resetGame() 后存档清空 → 自然回到入口。
 * 这修掉了 sessionStorage 版「开新标签/重启浏览器就乱触发入口打断调查」的问题：
 * 同一浏览器的进度是跨标签、跨重启稳定的（localStorage 持久化）。
 * AppRouter 始终挂载在底层，IntroScreen 作为 position:fixed 覆盖层盖在其上；
 * 数据加载已在 main.tsx 的 await loadGameData() 完成，进入游戏即就绪。
 *
 * 删掉 Vite 默认 App 内容（hero/计数器等）。
 */
import { ImageViewerProvider } from '@/ui/ImageViewer'
import { AppRouter } from '@/apps/PhoneShell/AppRouter'
import { IntroScreen } from '@/apps/PhoneShell/IntroScreen'
import { useGameStore } from '@/game/gameStore'

function App() {
  // 依据持久化存档判断：无进度且未通关 → 显示入口；否则直接进游戏。
  const showIntro = useGameStore(
    (s) => s.solvedPuzzleIds.length === 0 && !s.finished,
  )

  return (
    <ImageViewerProvider>
      <AppRouter />
      {showIntro ? <IntroScreen onEnter={() => { /* AppRouter 已在底层挂载，覆盖层移除即进入 */ }} /> : null}
    </ImageViewerProvider>
  )
}

export default App
