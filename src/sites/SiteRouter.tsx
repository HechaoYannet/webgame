/**
 * src/sites/SiteRouter.tsx
 *
 * 全屏站点路由总入口（重写后：调查网站作为独立真网页，与手机/游戏系统完全解耦）。
 *
 * 路由：#/site/:siteId/*（见 AppRouter）。本组件按 :siteId 取对应站点根组件挂载，
 * 站点内部自带 <Routes> 做站内导航（相对路径）。站点根在 <Outlet/> 上层渲染，
 * 让站点的嵌套 <Routes> 生效。
 *
 * 聚合方式（镜像 AppRegistry）：import.meta.glob 扫描各站根 index.tsx，
 * eager 收集各站 default export（站点根组件）+ 一个 siteId 导出。
 *
 * 关键：本组件及各站点根**禁止** import @/engine / @/game / @/data/loader / @/ui / @/utils /
 * 任何 src/apps/——站点与游戏系统完全隔离。仅可用 @/sites/shared/* 与 @/types（站点渲染所需类型）。
 *
 * 数据就绪：main.tsx 已 await loadGameData() 再 render，新标签同 SPA 故数据已加载。
 * 站点用 getPageContent(pageId)（@/sites/shared/pageContent）取本站页面，不经游戏 loader。
 */
import { Suspense, lazy, useMemo, type ComponentType, type ReactElement } from 'react'
import { Outlet, useParams } from 'react-router'

interface SiteModule {
  default: ComponentType
  siteId: string
}

// glob 各 site 根（each site: src/sites/<siteId>/index.tsx，default export = 根组件，named siteId = 标识）
const siteModules = import.meta.glob<{ default: ComponentType; siteId: string }>(
  './*/index.tsx',
  { eager: true },
)

/** siteId → 懒加载根组件。各站根自带的 <Routes> 在挂载后接管站内导航。 */
const siteByPage: Record<string, ComponentType> = (() => {
  const out: Record<string, ComponentType> = {}
  for (const [path, mod] of Object.entries(siteModules)) {
    const m = mod as unknown as SiteModule
    const id = m.siteId ?? path
    out[id] = m.default
  }
  return out
})()

function SiteFallback(): ReactElement {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#5a6473' }}>
      加载中…
    </div>
  )
}

function SiteNotFound({ siteId }: { siteId?: string }): ReactElement {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'system-ui', color: '#5a6473' }}>
      <h2 style={{ margin: 0 }}>网站不存在</h2>
      <span style={{ fontSize: 13 }}>{siteId ? `未知站点：${siteId}` : '未指定站点'}</span>
    </div>
  )
}

export default function SiteRouter(): ReactElement {
  const params = useParams<{ siteId: string }>()
  const siteId = params.siteId
  const Root = siteId ? siteByPage[siteId] : undefined

  const LazyRoot = useMemo(() => (Root ? lazy(() => Promise.resolve({ default: Root })) : null), [Root])

  if (!siteId || !LazyRoot) {
    return <SiteNotFound siteId={siteId} />
  }

  // 站点全屏滚动容器：独立滚动上下文，绕开全局 #root 的 overflow:hidden（那是手机
  // 外壳为锁屏设的，会让站点页无法滚动、只能看到中间）。position:fixed inset:0 占满
  // 视口，overflow-y:auto 让整站可上下滚动。站点根自带底色/全宽不因之改变。
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <Suspense fallback={<SiteFallback />}>
        <LazyRoot />
        <Outlet />
      </Suspense>
    </div>
  )
}
