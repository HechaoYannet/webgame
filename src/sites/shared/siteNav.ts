/**
 * src/sites/shared/siteNav.ts
 *
 * 站内导航辅助——修复"站内链接相对解析累积导致 404"的 BUG。
 *
 * 背景：站点根挂在 AppRouter 的 /site/:siteId/* 下，但站点内部用的是 react-router
 * 的"孤立 <Routes>"（descendant routes），其 <Link to="list"> 的相对解析**不会**以
 * /site/<siteId>/ 为 base，而是相对当前 URL 末段拼接 → 在 /list 页点 to="list"
 * 变成 /list/list，再点变 /list/list/list …… 404 累积。
 *
 * 修复：站点导航用**绝对站点路径**。本 hook 从路由参数取 siteId，返回站点根
 * `/site/<siteId>`；sitePath(base, rel) 把相对段拼成绝对路径。站点改用
 * `<Link to={sitePath(useSiteBase(), 'list')}>` 即可，链接恒定指向
 * `/site/<siteId>/list`，与当前 URL 无关，无累积。
 */
import { useParams } from 'react-router'

/** 取当前站点根路径 `/site/<siteId>`（从路由 :siteId 参数）。 */
export function useSiteBase(): string {
  const { siteId } = useParams<{ siteId: string }>()
  return `/site/${siteId ?? ''}`
}

/**
 * 把站点根 base 与相对段 rel 拼成绝对站点路径。
 *   sitePath('/site/site-arxiv', 'list') → '/site/site-arxiv/list'
 *   sitePath('/site/site-arxiv', 'abs/2603.01187') → '/site/site-arxiv/abs/2603.01187'
 *   sitePath('/site/site-arxiv', '') → '/site/site-arxiv'
 * rel 若已是绝对路径（以 / 开头）且以 base 开头则原样返回；否则以 base 为准拼。
 */
export function sitePath(base: string, rel: string): string {
  const cleanRel = (rel ?? '').replace(/^\/+/, '')
  const cleanBase = (base ?? '').replace(/\/+$/, '')
  if (!cleanRel) return cleanBase || '/'
  return `${cleanBase}/${cleanRel}`
}
