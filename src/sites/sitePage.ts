/**
 * src/sites/sitePage.ts
 *
 * 全屏站点路由工具（重写后：调查网站作为独立真网页，新标签打开站点根）。
 *
 * - siteIdForPageId(pageId)：pageId → siteId（遍历 sites.json 反查）。
 * - openSitePage(pageId)：window.open 新标签打开该 page 所属站点的根（#/site/:siteId），
 *   站点内部自带 <Routes> 做站内导航，故只需打开站点根。
 *
 * 注意：window.open 需用户手势触发（公众号 link/QQ 链接等 onClick 内调用），否则被拦截。
 *
 * 本文件属共享层（非站点自身），可 import @/data/loader 取 sites 反查。
 * 站点代码（src/sites/<siteId>/**）不直接用本文件——它们在站内导航用 react-router。
 */
import { getAllSites } from '@/data/loader'

/** pageId → siteId 反查缓存（sites.json 加载后建一次）。 */
let _pageToSite: Map<string, string> | null = null

function pageToSiteMap(): Map<string, string> {
  if (_pageToSite) return _pageToSite
  const m = new Map<string, string>()
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

/** pageId 反查其所属 siteId（未找到返回 undefined）。 */
export function siteIdForPageId(pageId: string): string | undefined {
  return pageToSiteMap().get(pageId)
}

/** 构造站点根 hash 路由：#/site/:siteId。 */
export function siteRootHash(siteId: string): string {
  return `#/site/${siteId}`
}

/** 站点根的完整 URL（供 window.open 用）。 */
export function siteRootUrl(siteId: string): string {
  // import.meta.env.BASE_URL 必须原样出现（CLAUDE.md §2，构建时静态替换）
  return `${import.meta.env.BASE_URL}${siteRootHash(siteId)}`
}

/**
 * 在新标签页打开某 page 所属站点（打开站点根，站内导航由站点自理）。
 * 需在用户手势（onClick）内调用。返回是否成功打开（pageId 无对应 site 时 false）。
 */
export function openSitePage(pageId: string): boolean {
  const siteId = siteIdForPageId(pageId)
  if (!siteId) {
    // console.warn(`[sitePage] pageId 无对应 site，无法打开：${pageId}`)
    // return false
    //打开外链，而不是拼接URL
    window.open(pageId)
    return true
  }
  window.open(siteRootUrl(siteId), '_blank', 'noopener')
  return true
}

/** 仅测试/重置用：清缓存。 */
export function resetSitePageCache(): void {
  _pageToSite = null
}
