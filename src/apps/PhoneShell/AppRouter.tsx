/**
 * src/apps/PhoneShell/AppRouter.tsx
 *
 * HashRouter 路由（CLAUDE.md §2 强制 HashRouter，GitHub Pages 刷新不 404）。
 * React Router v8 用 createHashRouter + <RouterProvider>，
 * 路由对象用 Component（大写，v7+ 新增，替代 v6 element）。
 *
 * 路由：
 *   /                     → RootLayout（PhoneShell 外壳 + engine 初始化 + 导航绑定）
 *                              内含 <Outlet/> 渲染子路由
 *   /app/:appId           → 对应 App lazy 组件（AppRegistry 聚合）
 *   index (within /)      → Desktop（桌面）
 *   *                     → NotFound（兜底回桌面）
 *
 * 关键：AppNavigationService 需要注入 useNavigate；useNavigate 必须在 RouterProvider
 * 内调用。因此 RootLayout 作为根布局组件挂在 "/" 路由下，在 router context 内执行
 * initEngine + bindNavigate + wireShellToEngine。
 *
 * AppRegistry 自动聚合 apps，路由按 appId 派发，不硬编码任何 App。
 */
import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  createHashRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useNavigate,
  type RouteObject,
} from 'react-router'
import { Desktop } from '@/apps/PhoneShell/Desktop'
import { apps, appById } from '@/apps/PhoneShell/AppRegistry'
import { PhoneShell } from '@/apps/PhoneShell/PhoneShell'
import { Spinner } from '@/ui/Primitives'
import { palette } from '@/ui/theme'
import { initEngine } from '@/engine'
import { bindNavigate, bindAppListener } from '@/engine/feedback/AppNavigationService'
import { wireShellToEngine } from '@/utils/shellState'
import { loadGameData } from '@/data/loader'

function AppFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: palette.bgScreen }}>
      <Spinner size={32} />
    </div>
  )
}

/** 根布局：PhoneShell 外壳 + 数据加载 + engine 启动 + 导航绑定。位于 router context 内。 */
function RootLayout(): ReactElement {
  const navigate = useNavigate()
  const wired = useRef(false)
  // 数据加载 + 引擎启动状态：Shell/各App 的同步查询（getChapterById 等）需先 await loadGameData，
  // 否则 loader.requireIndex 会抛 "GameData 未加载"。initEngine 末尾的 reevaluateChapters 也读 loader，
  // 故顺序必须是：loadGameData() → initEngine() → 渲染 Shell。
  const [dataState, setDataState] = useState<{ ready: boolean; error?: string }>({ ready: false })

  useEffect(() => {
    if (wired.current) return
    wired.current = true
    let cancelled = false
    loadGameData()
      .then(() => {
        if (cancelled) return
        initEngine()
        bindNavigate((path) => navigate(path))
        bindAppListener(() => {
          /* 当前 App 变化由路由自身反映 */
        })
        wireShellToEngine()
        setDataState({ ready: true })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setDataState({ ready: false, error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (!dataState.ready) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          background: palette.bgScreen,
          color: palette.textSecondary,
        }}
      >
        <Spinner size={32} />
        <div style={{ fontSize: 13 }}>
          {dataState.error ? `数据加载失败：${dataState.error}` : '加载游戏数据…'}
        </div>
      </div>
    )
  }

  return (
    <PhoneShell>
      <Suspense fallback={<AppFallback />}>
        <Outlet />
      </Suspense>
    </PhoneShell>
  )
}

/** 为每个 App 生成 lazy 路由组件。 */
function makeAppRouteComponent(appId: string): React.ComponentType {
  const entry = appById.get(appId)
  if (!entry) {
    return () => <Navigate to="/" replace />
  }
  const Lazy = entry.LazyComponent
  return function AppRoute() {
    return <Lazy />
  }
}

const routes: RouteObject[] = [
  // 全屏站点路由（无手机框）：调查网站作为真网页，新标签打开。
  // 独立于 PhoneShell，SiteView 内部自调 loadGameData()。
  {
    path: '/site/:siteId/:pageId',
    lazy: async () => {
      const mod = await import('@/sites/SiteView')
      return { Component: mod.default }
    },
  },
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: Desktop },
      ...apps
        .map((a) => a.appId)
        .map<RouteObject>((appId) => ({
          path: `app/${appId}`,
          Component: makeAppRouteComponent(appId),
        })),
      { path: '*', Component: () => <Navigate to="/" replace /> },
    ],
  },
]

const router = createHashRouter(routes)

export function AppRouter(): ReactElement {
  return <RouterProvider router={router} />
}
