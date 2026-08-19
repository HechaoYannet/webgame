/**
 * src/sites/sitePage.ts
 *
 * 全屏站点路由工具（重写后：调查网站作为真网页，新标签页打开）。
 *
 * - siteIdForPageId(pageId)：pageId → siteId（遍历 sites.json 的 pages 反查）。
 * - sitePageHash(siteId, pageId)：构造全屏站点 hash 路由 #/site/:siteId/:pageId。
 * - openSitePage(pageId)：window.open 新标签打开该官网页（公众号 link、QQ 链接等调用）。
 *
 * 单 SPA 全屏路由（#/site/...）：与手机框同一 JS 上下文，点上东西直接触发倒计时/
 * 短信/门铃（同 store），无需跨标签通信桥。站点页用 history.pushState 站内导航，
 * 真实浏览器前进/后退/历史可用。
 *
 * 注意：window.open 需用户手势触发（公众号 link 点击），否则被浏览器拦截。
 */
import { getAllSites } from '@/data/loader'
import type { PageId } from '@/types'

/** pageId → siteId 反查缓存（sites.json 加载后建一次）。 */
let _pageToSite: Map<PageId, string> | null = null

function pageToSiteMap(): Map<PageId, string> {
  if (_pageToSite) return _pageToSite
  const m = new Map<PageId, string>()
  try {
    for (const site of getAllSites()) {
      for (const pid of site.pages) m.set(pid, site.id)
    }
  } catch {
    // loader 未加载阶段返回空表
  }
  _pageToSite = m
  return m
}

/** 给定 pageId 反查其所属 siteId（未找到返回 undefined）。 */
export function siteIdForPageId(pageId: PageId): string | undefined {
  return pageToSiteMap().get(pageId)
}

/** 构造全屏站点 hash 路由路径：#/site/:siteId/:pageId。 */
export function sitePageHash(siteId: string, pageId: PageId): string {
  return `#/site/${siteId}/${pageId}`
}

/** 同 SPA 内、全屏站点路由的完整 URL（供 window.open 用）。 */
export function sitePageUrl(pageId: PageId): string | undefined {
  const siteId = siteIdForPageId(pageId)
  if (!siteId) return undefined
  // import.meta.env.BASE_URL 原样出现（CLAUDE.md §2，构建时静态替换）
  return `${import.meta.env.BASE_URL}${sitePageHash(siteId, pageId)}`
}

/**
 * 在新标签页打开某官网页（公众号 link / QQ 链接等调用）。
 * 需在用户手势（onClick）内调用。同 SPA，新标签与手机框共享 localStorage 存档与
 * 同 JS 上下文（但各自独立 React 实例——状态经持久化/事件广播传递）。
 *
 * 返回是否成功打开（pageId 无对应 site 时返回 false）。
 */
export function openSitePage(pageId: PageId): boolean {
  const url = sitePageUrl(pageId)
  if (!url) {
    console.warn(`[sitePage] pageId 无对应 site，无法打开：${pageId}`)
    return false
  }
  window.open(url, '_blank', 'noopener')
  return true
}

/** 仅测试/重置用：清缓存。 */
export function resetSitePageCache(): void {
  _pageToSite = null
}
