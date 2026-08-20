/**
 * src/apps/PhoneShell/AppRouter.tsx
 *
 * HashRouter 路由（CLAUDE.md §2 强制 HashRouter，GitHub Pages 刷新不 404）。
 * React Router v8 用 createHashRouter + <RouterProvider>，路由对象用 Component（大写）。
 *
 * 重写后（玩家决策 2026-08-19）：已删引擎 initEngine/wireShellToEngine/bindNavigate。
 * 只剩数据就绪门控（await loadGameData）+ 直接 useNavigate。
 *
 * 路由：
 *   /site/:siteId/*       → SiteRouter（全屏独立网站，无手机框，与游戏系统解耦）
 *   /                     → RootLayout（PhoneShell 外壳 + 数据就绪门控）内含 <Outlet/>
 *   /app/:appId           → 对应 App lazy 组件（AppRegistry 聚合）
 *   index (within /)      → Desktop（桌面）
 *   *                     → NotFound（兜底回桌面）
 *
 * main.tsx 已 await loadGameData() 再 render；RootLayout 此处再调一次为幂等缓存命中，
 * 仅维持"数据就绪才渲染 Shell"的守卫（Shell/各App 同步查询需 loader 已加载）。
 */
import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  createHashRouter,
  Navigate,
  Outlet,
  RouterProvider,
  type RouteObject,
} from 'react-router'
import { Desktop } from '@/apps/PhoneShell/Desktop'
import { apps, appById } from '@/apps/PhoneShell/AppRegistry'
import { PhoneShell } from '@/apps/PhoneShell/PhoneShell'
import { Spinner } from '@/ui/Primitives'
import { palette } from '@/ui/theme'
import { loadGameData } from '@/data/loader'

function AppFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: palette.bgScreen }}>
      <Spinner size={32} />
    </div>
  )
}

/** 根布局：PhoneShell 外壳 + 数据加载就绪门控。位于 router context 内。 */
function RootLayout(): ReactElement {
  const wired = useRef(false)
  // Shell/各App 的同步查询需先 await loadGameData，否则 loader.requireIndex 抛错。
  const [dataState, setDataState] = useState<{ ready: boolean; error?: string }>({ ready: false })

  useEffect(() => {
    if (wired.current) return
    wired.current = true
    let cancelled = false
    loadGameData()
      .then(() => {
        if (cancelled) return
        setDataState({ ready: true })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setDataState({ ready: false, error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

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
  // 全屏站点路由（无手机框）：独立真网站，由 SiteRouter 按 :siteId 挂载各站根。
  // 站点自带 <Routes> 做站内导航（splat 接管子路径）。与游戏系统完全解耦。
  {
    path: '/site/:siteId/*',
    lazy: async () => {
      const mod = await import('@/sites/SiteRouter')
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
