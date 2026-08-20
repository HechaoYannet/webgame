/**
 * site-endfield —— 《明日方舟：终末地》官方网站（仿 Hypergryph 官网）。
 *
 * 本站只有一个公开页面 page-endfield-news（全面测试资格公告），
 * 醒目展示公测日期 2025-11-28。
 *
 * 结构（站点交付契约）：
 *  - 本文件 default export 根组件，其内用 react-router 的 Routes 做站内导航。
 *  - 根路径与 /news 都映射到 NewsPage（路由派发由 SiteRouter 注入 URL 前缀，
 *    本站根挂在 hash 路由 /site/site-endfield 下，站内用相对路径 news）。
 *  - Layout：顶栏 + 主区 + 页脚的外壳，所有页面共用。
 *  - manifest.ts：站点元数据（SiteRouter 不强依赖，留存以备编排/审计）。
 *
 * 边界：仅 import react、react-router、@/sites/shared 子目录、@/types、本目录文件。
 * 不碰 @/engine、@/game、@/data/loader、@/ui、@/utils、任何 src/apps 下路径。
 *
 * 说明：本站仅一个公开页面，无登录后台，故不引入 checkLogin / loginForm 块处理。
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { PlaceholderImage } from '@/sites/shared/placeholder'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock } from '@/types'
import { Layout } from './Layout'
import { NewsPage } from './NewsPage'
import './site.css'

export const siteId = 'site-endfield'

/** 本站所有页面 id（取自 sites.json，本站仅 1 个）。 */
const PAGE_ID_NEWS = 'page-endfield-news'

/**
 * 站点根组件。SiteRouter 把 hash 路由 /site/site-endfield 下的分支交给本组件，
 * 本组件用相对路径 Routes 做站内导航。根路径与 news 都显示公告页。
 */
export default function EndfieldSite(): ReactElement {
  const location = useLocation()
  // 各页面内容懒取，缓存到 state；PageLoader 内部 getPageContent 再做内存缓存。
  const newsPage = usePage(PAGE_ID_NEWS)

  // 高亮当前导航项
  const activePath = useMemo(() => normalizePath(location.pathname), [location.pathname])

  return (
    <Layout activePath={activePath}>
      <Routes>
        <Route
          path="/"
          element={<NewsPage page={newsPage} />}
        />
        <Route
          path="news"
          element={<NewsPage page={newsPage} />}
        />
        {/* 其它站内路径兜底同样落在公告页（本站只有一个页面） */}
        <Route
          path="*"
          element={<NewsPage page={newsPage} />}
        />
      </Routes>
    </Layout>
  )
}

/** 取一个站点页内容，缓存到 state。 */
function usePage(pageId: string): SitePage | null {
  const [page, setPage] = useState<SitePage | null>(null)
  useEffect(() => {
    let cancelled = false
    void getPageContent(pageId).then((p) => {
      if (!cancelled) setPage(p)
    })
    return () => {
      cancelled = true
    }
  }, [pageId])
  return page
}

/** 把浏览器路径末段作为站内导航基线。空串视为根。 */
function normalizePath(path: string): string {
  if (!path) return '/'
  const idx = path.lastIndexOf('/')
  const last = idx >= 0 ? path.slice(idx + 1) : path
  return last ? last : '/'
}

/** 渲染页面内容块。Layout / 新闻页共用。 */
export function renderBlocks(blocks: PageBlock[]): ReactElement {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  )
}

/** 单块渲染。本站 JSON 只用到 hero / paragraph / callout 三种，其余忽略。 */
function BlockView({ block }: { block: PageBlock }): ReactElement | null {
  switch (block.type) {
    case 'hero':
      return (
        <header className="site-endfield__hero">
          {block.imageAssetId && (
            <PlaceholderImage
              assetId={block.imageAssetId}
              alt={block.heading}
              className="site-endfield__hero-img"
            />
          )}
          <h1 className="site-endfield__hero-heading">{block.heading}</h1>
          {block.subheading && <p className="site-endfield__hero-sub">{block.subheading}</p>}
        </header>
      )
    case 'paragraph':
      return <p className="site-endfield__para">{block.text}</p>
    case 'callout': {
      const variant = block.variant ?? 'info'
      const cls =
        variant === 'warning'
          ? 'site-endfield__callout site-endfield__callout--warning'
          : 'site-endfield__callout site-endfield__callout--info'
      return <div className={cls}>{block.text}</div>
    }
    default:
      // 本站未用到 form / table / loginForm / pdfViewer / nav / articleList 等；忽略
      return null
  }
}

/**
 * 顶栏使用的导航项。`to` 存**站内相对段**（如 `news` / `''` 站点根），
 * 由 NavList 经 sitePath(base, to) 解析成**绝对站点路径**，避免孤立 Routes
 * 的 <Link to> 相对解析累积成 /news/news。
 */
export const NAV_LINKS: { label: string; to: string }[] = [
  { label: '首页', to: '' },
  { label: '新闻', to: 'news' },
  { label: '角色', to: 'news' },
  { label: '预约', to: 'news' },
]

/** nav 头部按钮统一格式：首页指向站点根（sitePath(base, '')）。 */
export function NavList(): ReactElement {
  const base = useSiteBase()
  return (
    <nav className="site-endfield__navlinks">
      {NAV_LINKS.map((l) => (
        <Link key={l.label} to={sitePath(base, l.to)} className="site-endfield__navlink">
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
