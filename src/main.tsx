/**
 * src/main.tsx — 应用入口（frontend-phone-shell 自有）。
 *
 * 挂载 App 到 #root。删掉默认 React.StrictMode 装饰外不再引用 Vite 默认内容。
 * HashRouter 由 AppRouter 内部 createHashRouter + RouterProvider 注入（§2 强制 HashRouter）。
 *
 * 全 app 前置：先 await loadGameData() 完成数据加载与索引，再 render。
 * 这样 SiteView（站点路由）与 PhoneShell 所有同步 getter（getChapterById 等）在
 * 首次渲染即安全，无需任何分支门控（玩家要求"不需要门控"）。loadGameData 幂等缓存，
 * RootLayout 内的二次调用为缓存命中。
 */
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadGameData } from '@/data/loader'

void loadGameData().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})

