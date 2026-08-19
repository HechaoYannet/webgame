/**
 * src/main.tsx — 应用入口（frontend-phone-shell 自有）。
 * 挂载 App 到 #root。删掉默认 React.StrictMode 装饰外不再引用 Vite 默认内容。
 * HashRouter 由 AppRouter 内部 createHashRouter + RouterProvider 注入（§2 强制 HashRouter）。
 */
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
